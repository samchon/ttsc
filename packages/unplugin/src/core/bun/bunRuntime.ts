import type { BunRuntimeGlobal } from "./BunRuntimeGlobal";

/**
 * The Bun runtime global when the current process runs under Bun, detected by a
 * callable `Bun.plugin`.
 *
 * @returns `undefined` off Bun, which lets the import-time registration stay a
 *   silent no-op under Node while an explicit `register` call throws.
 */
export function bunRuntime(): BunRuntimeGlobal | undefined {
  const runtime = (globalThis as { Bun?: BunRuntimeGlobal }).Bun;
  return runtime !== undefined && typeof runtime.plugin === "function"
    ? runtime
    : undefined;
}
