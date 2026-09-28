import { api, ApiError } from "./api";

const pending = new Map<string, string>();
/** Keep a tender's key across uncertain network/server failures and page reloads. */
export async function financialRequest<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const identity = `pinky:pending-tender:${path}:${JSON.stringify(body)}`;
  let key = pending.get(identity);
  try {
    key ??= sessionStorage.getItem(identity) ?? undefined;
  } catch {
    /* memory fallback */
  }
  key ??= crypto.randomUUID();
  pending.set(identity, key);
  try {
    sessionStorage.setItem(identity, key);
  } catch {
    /* memory fallback */
  }
  const clear = () => {
    pending.delete(identity);
    try {
      sessionStorage.removeItem(identity);
    } catch {
      /* memory fallback */
    }
  };
  try {
    const result = await api.post<T>(path, body, {
      headers: { "Idempotency-Key": key },
    });
    clear();
    return result;
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      ![408, 429].includes(error.status)
    )
      clear();
    throw error;
  }
}
