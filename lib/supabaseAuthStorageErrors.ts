/**
 * Supabase Auth가 브라우저 Web Locks / IndexedDB를 쓸 때,
 * 동시 요청·React Strict Mode 이중 effect 등으로 나는 개발 환경용 오류인지 판별한다.
 */
export const isBenignAuthStorageError = (e: unknown): boolean => {
  if (e instanceof DOMException && e.name === "AbortError") return true
  if (e instanceof Error && e.message.includes("Lock broken")) return true
  return false
}
