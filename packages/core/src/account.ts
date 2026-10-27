/** E-mail sintético de login: o usuário digita só o nome, o Supabase Auth recebe este e-mail. */
export function emailForUsername(username: string): string {
  return `${username}@vtt.local`;
}
