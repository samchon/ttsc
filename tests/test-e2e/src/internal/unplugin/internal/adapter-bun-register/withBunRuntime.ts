import type { CapturedPlugin } from "./CapturedPlugin";

/**
 * Run `body` with a Bun-like global installed for the whole scope, so both the
 * import-time auto-registration and any explicit `register(options)` call see
 * the same runtime. Every `Bun.plugin` registration is appended to `captured`.
 * The prior global is restored afterwards.
 */
export async function withBunRuntime(
  captured: CapturedPlugin[],
  body: () => Promise<void>,
): Promise<void> {
  const holder = globalThis as { Bun?: unknown };
  const priorBun = Object.getOwnPropertyDescriptor(holder, "Bun");
  Object.defineProperty(holder, "Bun", {
    configurable: true,
    enumerable: priorBun?.enumerable ?? true,
    writable: true,
    value: { plugin: (plugin: CapturedPlugin) => captured.push(plugin) },
  });
  try {
    await body();
  } finally {
    if (priorBun === undefined) delete holder.Bun;
    else Object.defineProperty(holder, "Bun", priorBun);
  }
}
