/** Best-effort error normalization for tgrid transport. */
export function normalizeError(error: unknown): unknown {
  if (error instanceof Error)
    return { name: error.name, message: error.message, stack: error.stack };
  if (
    error &&
    typeof error === "object" &&
    "message" in (error as Record<string, unknown>)
  )
    return error;
  return { name: "Error", message: String(error) };
}
