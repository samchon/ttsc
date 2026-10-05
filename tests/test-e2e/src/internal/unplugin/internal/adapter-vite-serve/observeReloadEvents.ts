/** Observe reload messages and transfer the actual HMR client's close lease. */
export async function observeReloadEvents(
  server: any,
): Promise<Array<{ type?: string }> & { close(): Promise<void> }> {
  const events: Array<{ type?: string }> = [];
  const address = server.httpServer.address();
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/`, "vite-hmr");
  const closed = new Promise<void>((resolve) =>
    socket.addEventListener("close", () => resolve(), { once: true }),
  );
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      socket.close();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          closed,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error("actual HMR client closure remained unresolved"),
                ),
              30000,
            );
          }),
        ]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    })());
  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(String(message.data));
    if (payload.type === "full-reload") events.push(payload);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
  } catch (error) {
    try {
      await close();
    } catch (closeError) {
      throw new AggregateError([error, closeError], "HMR startup and closure");
    }
    throw error;
  }
  return Object.assign(events, { close });
}
