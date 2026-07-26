import { BootTtscWorkerTerminationError } from "@ttsc/wasm";

export interface ITerminalCompilerWorkerRecovery {
  /** Atomically claim and fence the failed Worker generation. */
  claim(): boolean;
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
  if (!recovery.claim()) return true;
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
  const prefix = `[${code}] `;
  if (typeof error === "string") return error.startsWith(prefix);
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  return (
    record.code === code ||
    (typeof record.message === "string" && record.message.startsWith(prefix))
  );
}
