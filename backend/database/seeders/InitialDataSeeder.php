<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\PriceType;
use App\Enums\UserRole;
use App\Models\Price;
use App\Models\RegularHoliday;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * すべての環境（ローカル・本番）で入れる最初のデータ（docs/02 の「シーダー」）。
 *
 * - 管理者アカウント（画面からは作れないので、ここで作る。docs/01）
 * - 料金（平日 4,000円・土日 5,000円）
 * - 定休日（月曜）
 *
 * 【何度実行しても安全にする】
 * 本番でうっかり2回流しても壊れないようにする。特に、管理者が画面で変えた料金・定休日や
 * 管理者のパスワードを、2回目以降の実行で初期値に戻してしまわないこと。
 * R1 は updateOrCreate で毎回上書きしていたので、流すたびに管理者のパスワードが元に戻った。
 *
 * 実行: php artisan db:seed --class=InitialDataSeeder（db:seed だけでも DatabaseSeeder から呼ばれる）
 */
final class InitialDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedAdmin();
        $this->seedFacilitySettings();
    }

    /**
     * 管理者を作る。同じメールアドレスのユーザーがすでにいれば何もしない（パスワードも上書きしない）。
     */
    private function seedAdmin(): void
    {
        // env() を直接読まず config 経由にする（本番の config:cache 後も読めるように。config/facility.php）
        $email = config('facility.admin.email');
        $password = config('facility.admin.password');

        // 空のまま管理者を作らない。本番で環境変数を入れ忘れたら、ここで気づけるように止める
        if (! is_string($email) || $email === '' || ! is_string($password) || $password === '') {
            throw new RuntimeException(
                '管理者を作れません。環境変数 ADMIN_EMAIL と ADMIN_PASSWORD を設定してください（config/facility.php の admin）。'
            );
        }

        if (User::query()->where('email', $email)->exists()) {
            return;
        }

        // role は User の #[Fillable] に入れていない（会員登録の API から管理者を作れないようにするため）。
        // そのため create() ではなく、制限を受けない forceFill() で明示的に書き込む。
        // パスワードは User の casts（'password' => 'hashed'）で、保存するときに自動でハッシュ化される
        (new User)->forceFill([
            'name' => '管理者',
            'email' => $email,
            'password' => $password,
            'role' => UserRole::Admin,
        ])->save();
    }

    /**
     * 料金と定休日を入れる。料金の行がまだ無いとき（＝初回）だけ入れる。
     *
     * 2回目以降に入れないのは、管理者が画面で変えた値（料金を変えた、定休日を外した など）を
     * 初期値に戻さないため。料金の行の有無で「初回かどうか」を判断する（料金は必ず2行あるはずのデータなので）。
     */
    private function seedFacilitySettings(): void
    {
        if (Price::query()->exists()) {
            return;
        }

        // 途中で失敗したとき、料金だけ入って定休日が入らない、といった中途半端な状態を残さない
        DB::transaction(function (): void {
            Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);
            Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => 5000]);

            // 定休日は月曜。CarbonInterface::MONDAY は 1（0 = 日曜 … 6 = 土曜の数え方）
            RegularHoliday::query()->create(['day_of_week' => CarbonInterface::MONDAY]);
        });
    }
}
