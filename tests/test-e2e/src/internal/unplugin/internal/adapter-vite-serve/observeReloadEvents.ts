/** Observe reload messages through a real HMR WebSocket client. */
export async function observeReloadEvents(
  server: any,
): Promise<Array<{ type?: string }>> {
  const events: Array<{ type?: string }> = [];
  const address = server.httpServer.address();
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/`, "vite-hmr");
  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(String(message.data));
    if (payload.type === "full-reload") events.push(payload);
  });
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  return events;
}
