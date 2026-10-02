<?php

declare(strict_types=1);

use App\Enums\PriceType;
use App\Events\FacilityChanged;
use App\Listeners\ForgetCalendarCache;
use App\Listeners\RevalidateFrontendCache;
use App\Models\Price;
use App\Models\RegularHoliday;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Events\CallQueuedListener;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

/*
 * 料金・定休日を変えた後の Listener のテスト。docs/06 の「フロントの再検証（B6）」「カレンダーのキャッシュ」。
 * テストではキューがその場で動く（QUEUE_CONNECTION=sync）。外への HTTP は Http::fake() で止めて、呼ばれ方を見る。
 */

beforeEach(function () {
    config([
        'services.frontend.internal_url' => 'http://frontend.test',
        'services.frontend.revalidate_secret' => 'test-secret',
    ]);
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);
    Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => 5000]);
    $this->admin = User::factory()->admin()->create();
    // フロントが返す状態。テストごとに変えられるようにする
    // （Http::fake() を後から重ねて呼んでも、先に登録した返事が優先されるため）
    $this->frontendStatus = 200;
    Http::fake(['frontend.test/*' => fn () => Http::response(['ok' => true], $this->frontendStatus)]);
});

it('FacilityChanged を受けるよう登録されている', function () {
    Event::fake();

    Event::assertListening(FacilityChanged::class, RevalidateFrontendCache::class);
    Event::assertListening(FacilityChanged::class, ForgetCalendarCache::class);
});

it('B6: 料金を変えたら、フロントの /internal/revalidate を合言葉付きの POST で呼ぶ', function () {
    $this->actingAs($this->admin)->putJson('/api/admin/prices', ['weekday' => 4500, 'weekend' => 6000])->assertOk();

    Http::assertSent(fn (Request $request): bool => $request->url() === 'http://frontend.test/internal/revalidate'
        && $request->method() === 'POST'
        && $request->hasHeader('Authorization', 'Bearer test-secret'));
});

it('定休日を変えたときも呼ぶ', function () {
    $this->actingAs($this->admin)->putJson('/api/admin/regular-holidays', ['days' => [2]])->assertOk();

    Http::assertSentCount(1);
});

it('作り直しは、キューに積んで行う（管理者の保存の返事を待たせない）', function () {
    Queue::fake();

    $this->actingAs($this->admin)->putJson('/api/admin/prices', ['weekday' => 4500, 'weekend' => 6000])->assertOk();

    Queue::assertPushed(
        CallQueuedListener::class,
        fn (CallQueuedListener $job): bool => $job->class === RevalidateFrontendCache::class,
    );
    Http::assertNothingSent();
});

it('予約の作成では呼ばない（施設情報は変わらないため）', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));

    $this->actingAs(User::factory()->create())
        ->postJson('/api/reservations', ['date' => '2026-10-07', 'start_hour' => 12, 'end_hour' => 14])
        ->assertCreated();

    Http::assertNothingSent();
});

it('フロントがエラーを返したら例外にして、キューにやり直させる', function () {
    $this->frontendStatus = 401;

    expect(fn () => app(RevalidateFrontendCache::class)->handle(new FacilityChanged))
        ->toThrow(RequestException::class);
});

it('定休日を変えた直後の /calendar に反映される（定休日のキャッシュが消えている）', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));
    RegularHoliday::query()->create(['day_of_week' => 1]);
    // 2026-10-07（水）は受付中。カレンダーを見て、定休日の一覧（月曜）をキャッシュに入れる
    $this->getJson('/api/calendar?from=2026-10-07&to=2026-10-07')->assertJsonPath('data.0.closed_reason', null);

    nextRequest();
    $this->actingAs($this->admin)->putJson('/api/admin/regular-holidays', ['days' => [3]])->assertOk();

    nextRequest();
    $this->getJson('/api/calendar?from=2026-10-07&to=2026-10-07')
        ->assertJsonPath('data.0.closed_reason', 'regular_holiday');
});
