import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/*
 * 予約がある日を休業日にするときの確認ダイアログ（docs/08 の 6.6）。
 *
 *   この日には予約が2件あります
 *     休業日にすると、2件の予約をすべてキャンセルし、
 *     会員の方には施設都合のキャンセルメールを送ります。
 *     [戻る] [予約をキャンセルして休業日にする]
 *
 * R1 のボタンは「強制設定する」で、何が起きるのかが分かりにくかった。起きることをそのまま書く。
 * 送信中は閉じられない。失敗したら、閉じずに中にエラーを出す（docs/08 の 1.3）。
 * HolidayForm の子として import されるので、"use client" は書かない。
 */

type Props = {
  /** キャンセルされる予約の件数。null なら閉じている */
  reservationCount: number | null;
  /** 送信中か */
  busy: boolean;
  /** 送り直しで失敗したときの文言 */
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function HolidayConflictDialog({
  reservationCount,
  busy,
  error,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Dialog
      open={reservationCount !== null}
      onClose={onClose}
      title={`この日には予約が${reservationCount ?? 0}件あります`}
      busy={busy}
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-700">
          休業日にすると、{reservationCount}
          件の予約をすべてキャンセルし、会員の方には施設都合のキャンセルメールを送ります。
        </p>

        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            戻る
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={busy}
            loadingText="登録中..."
          >
            予約をキャンセルして休業日にする
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
