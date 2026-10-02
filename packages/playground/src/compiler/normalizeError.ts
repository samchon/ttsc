/**
 * Normalize native errors to enumerable fields for tgrid transport; preserve
 * message-bearing records and stringify other thrown values.
 *
 * @evidence contracts/common.md#principled-implementation Explicit Error field copying preserves non-enumerable message and stack while carrying the terminal-runtime string code across RPC.
 * @evidence contracts/common.md#clear-and-simple-design One normalization boundary leaves rendering and recovery classification to their consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The mapper carries actual errors without converting rejection into fabricated compiler success.
 * @evidence contracts/common.md#meaningful-documentation Native prose states copying and preservation policies, separated from tags under the documentation skill.
 */
export function normalizeError(error: unknown): unknown {
  if (error instanceof Error) {
    const normalized: {
      code?: string;
      message: string;
      name: string;
      stack?: string;
    } = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
    const code = (error as Error & { code?: unknown }).code;
    if (typeof code === "string") normalized.code = code;
    return normalized;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in (error as Record<string, unknown>)
  )
    return error;
  return { name: "Error", message: String(error) };
}
