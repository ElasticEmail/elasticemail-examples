/** Extract the { error } body from a failed $fetch call */
export function errorMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { error?: string } };
  return e?.data?.error || fallback;
}
