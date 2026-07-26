import { BootTtscWorkerTerminationError } from "@ttsc/wasm";

export interface ITerminalCompilerWorkerRecovery {
  /** Fence work that belongs to the failed Worker generation. */
  invalidate(): void;
  /** Close and clear that Worker generation. */
  reset(): Promise<void>;
  /** Publish the terminal error after the old Worker is no longer reachable. */
  fail(error: unknown): void;
}

/**
 * Replace a compiler Worker after its Go runtime started but boot never became
 * usable. Returns false for ordinary compile, transport, and plugin failures.
 */
export async function recoverTerminalCompilerWorker(
  error: unknown,
  recovery: ITerminalCompilerWorkerRecovery,
): Promise<boolean> {
  if (!requiresCompilerWorkerReplacement(error)) return false;
  recovery.invalidate();
  try {
    await recovery.reset();
  } finally {
    recovery.fail(error);
  }
  return true;
}

/** Recognize both local errors and their plain tgrid/JSON transport shape. */
export function requiresCompilerWorkerReplacement(error: unknown): boolean {
  const code = BootTtscWorkerTerminationError.CODE;
  if (typeof error === "string") return error.includes(code);
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  return (
    record.code === code ||
    (typeof record.message === "string" && record.message.includes(code))
  );
}
