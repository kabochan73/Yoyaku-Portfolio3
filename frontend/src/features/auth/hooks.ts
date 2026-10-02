import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchCurrentUser, login, logout, register } from "./api";
import type { User } from "./types";

/*
 * 画面から使う認証の hook（docs/05 の「features/<機能>/hooks.ts」）。
 *
 * 取る（useQuery）・送る（useMutation）の状態（読み込み中・送信中・エラー）は TanStack Query に任せる。
 * R1 は submitting・submitError などを useState で手書きしていた（D10）。
 *
 * 使い方（画面の部品の中で）:
 *   const { data: user, isPending } = useCurrentUser();   // user は User か null
 *   const loginMutation = useLogin();
 *   loginMutation.mutate({ email, password });            // 送信中は loginMutation.isPending が true
 */

/**
 * ログイン中のユーザー。未ログインなら data は null。
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: fetchCurrentUser,
    // 5分間は「新しい」とみなし、画面を切り替えるたびには取り直さない（ユーザー情報はめったに変わらないため）。
    // ログイン・ログアウト・プロフィール更新のときは、下の hook がデータを直接置き換える
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * ログイン。成功したら、返ってきたユーザーでログイン中のユーザーのデータを置き換える
 * （置き換えるので、取り直しの通信は要らない）。
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (user: User) => {
      queryClient.setQueryData(queryKeys.user, user);
    },
  });
}

/**
 * 会員登録。成功したら、そのままログインした状態になるので、ログイン中のユーザーを置き換える。
 */
export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: register,
    onSuccess: (user: User) => {
      queryClient.setQueryData(queryKeys.user, user);
    },
  });
}

/**
 * ログアウト。成功したら、保存しているデータを全部捨ててから、ログイン中のユーザーを null にする。
 * 全部捨てるのは、前の人の予約などが、次の人の画面に残らないようにするため。
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.user, null);
    },
  });
}
