/** Private order capabilities never appear in URLs, analytics, or public DTOs. */
const memory = new Map<string, string>();
export function rememberOrderAccess(order: {
  id: string;
  orderNumber: string;
  orderAccessToken?: string;
}) {
  if (!order.orderAccessToken) return;
  for (const key of [order.id, `number:${order.orderNumber}`]) {
    memory.set(key, order.orderAccessToken);
    try {
      localStorage.setItem(`pinky:order-access:${key}`, order.orderAccessToken);
    } catch {
      /* keep this session usable */
    }
  }
}
export function getOrderAccess(key: string): string | undefined {
  try {
    return (
      memory.get(key) ??
      localStorage.getItem(`pinky:order-access:${key}`) ??
      undefined
    );
  } catch {
    return memory.get(key);
  }
}
