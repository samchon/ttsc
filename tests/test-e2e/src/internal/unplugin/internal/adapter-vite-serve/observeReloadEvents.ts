/**
 * Observe actual HMR publications and retain the original client close lease.
 * A delivered frame remains earned before later closure; pending observations
 * check the same socket's failure/close. Caller cleanup attempts server and
 * client independently, and outer contained cancellation owns unresolved work.
 */
export async function observeReloadEvents(
  server: any,
): Promise<Array<{ type?: string }> & { readonly joined: boolean; check(): void; close(): Promise<void> }> {
  const events: Array<{ type?: string }> = [];
  const address = server.httpServer.address();
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/`, "vite-hmr");
  let failure: unknown;
  let failed = false;
  let ended = false;
  const closed = new Promise<void>((resolve) =>
    socket.addEventListener("close", () => { ended = true; resolve(); }, { once: true }),
  );
  socket.addEventListener("error", (error) => { failed = true; failure ??= error; });
  const check = (): void => {
    if (failed) throw failure;
    if (ended) throw new Error("original HMR client closed before publication");
  };
  let closing: Promise<void> | undefined;
  const close = () => (closing ??= (async () => {
    if (!ended) socket.close();
    await closed;
    if (failed) throw failure;
  })());
  socket.addEventListener("message", (message) => {
    if (failed || ended) return;
    try {
      const payload = JSON.parse(String(message.data));
      if (payload.type === "full-reload") events.push(payload);
    } catch (error) {
      failed = true;
      failure = error;
    }
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const open = () => { cleanup(); resolve(); };
      const error = (cause: Event) => { cleanup(); reject(cause); };
      const earlyClose = () => { cleanup(); reject(new Error("original HMR client closed before readiness")); };
      const cleanup = () => {
        socket.removeEventListener("open", open);
        socket.removeEventListener("error", error);
        socket.removeEventListener("close", earlyClose);
      };
      socket.addEventListener("open", open, { once: true });
      socket.addEventListener("error", error, { once: true });
      socket.addEventListener("close", earlyClose, { once: true });
    });
  } catch (error) {
    try {
      await close();
    } catch (closeError) {
      throw new AggregateError([error, closeError], "HMR startup and closure");
    }
    throw error;
  }
  const client = Object.assign(events, { check, close, joined: false });
  Object.defineProperty(client, "joined", { get: () => ended });
  return client;
}
