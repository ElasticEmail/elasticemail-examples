/** Extract the { error } body from a failed $fetch call */
export function errorMessage(err, fallback) {
  const e = err;
  return e?.data?.error || fallback;
}
