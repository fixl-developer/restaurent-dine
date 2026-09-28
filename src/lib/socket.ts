import { getOrderAccess } from "./orderAccess";
import { io, Socket } from "socket.io-client";
import { env } from "@/config/env";

/**
 * Socket.IO factory keyed by namespace. Reuses a single connection per
 * namespace across the app — components subscribe via `useSocket(namespace)`.
 */
const sockets = new Map<string, Socket>();
let getStaffToken: () => string | null = () => null;
let refreshStaffToken: () => Promise<string | null> = async () => null;
export function configureSocketAuth(
  getToken: () => string | null,
  refresh: () => Promise<string | null>,
) {
  getStaffToken = getToken;
  refreshStaffToken = refresh;
}

export type SocketNamespace =
  | "/staff"
  | "/kds"
  | "/guest"
  | "/now-serving"
  | "/menu"
  | "/tables"
  | "/billing"
  | "/orders";

export function getSocket(
  namespace: SocketNamespace,
  query: Record<string, string> = {},
): Socket {
  const key = namespace + JSON.stringify(query);
  const existing = sockets.get(key);
  if (existing) return existing;

  const socket = io(env.socketUrl + namespace, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    query,
    auth: (callback) =>
      callback(
        namespace === "/guest"
          ? { orderToken: getOrderAccess(query.orderId) }
          : { token: getStaffToken() },
      ),
  });
  if (namespace === "/staff" || namespace === "/kds") {
    let recovering = false;
    let recoveredToken: string | null = null;
    const recover = async () => {
      const token = getStaffToken();
      if (recovering || !token || recoveredToken === token) return;
      recovering = true;
      recoveredToken = token;
      try {
        const next = await refreshStaffToken();
        // A denied permission must not turn into an unbounded reconnect loop.
        recoveredToken = next;
        if (next && sockets.get(key) === socket) socket.connect();
      } finally {
        recovering = false;
      }
    };
    socket.on("connect", () => {
      recoveredToken = null;
    });
    socket.on(
      "connect_error",
      (error: Error & { data?: { code?: string } }) => {
        if (error.data?.code === "TOKEN_EXPIRED") void recover();
      },
    );
    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") void recover();
    });
  }
  sockets.set(key, socket);
  return socket;
}

export function closeAllSockets(): void {
  for (const socket of sockets.values()) socket.disconnect();
  sockets.clear();
}

// Hot module reload safety — keep no stale connections across HMR.
if (import.meta.hot) {
  import.meta.hot.dispose(() => closeAllSockets());
}
