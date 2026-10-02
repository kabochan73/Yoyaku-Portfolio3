/*
 * TanStack Query のデータの名前（キー）の一覧（docs/05 の「クエリキー」）。
 *
 * キーは「どのデータか」を表す名前で、同じキーのデータは1か所に保存され、使い回される。
 * 「取り直して」と指示するとき（invalidateQueries）も、このキーで指定する。
 *
 * R1 は ["calendar", month] のような名前を各所に直書きしていて、
 * 1か所の打ち間違いで取り直しが効かなくなる作りだった。ここに集めて、どこからも同じものを使う。
 *
 * 使うデータが増えたら、ここに足す（カレンダーは手順5、予約一覧は手順6、管理画面は手順7）。
 */
export const queryKeys = {
  /** ログイン中のユーザー（未ログインなら null） */
  user: ["user"] as const,
  /** 施設情報（GET /api/facility）。トップではサーバーで取った値を入れて、ブラウザでは取り直さない */
  facility: ["facility"] as const,
  /** 公開のカレンダー（GET /api/calendar） */
  calendar: {
    /** カレンダーの全部の週。予約・キャンセルの後に、まとめて取り直させるときに使う（手順6） */
    all: ["calendar"] as const,
    /** 1週間分。weekStart はその週の月曜日（"2026-10-05"） */
    week: (weekStart: string) => ["calendar", weekStart] as const,
  },
};
