import { stripTerminalEscapes } from "./stripTerminalEscapes";

/**
 * Render any thrown value as plain text for a bundler's error channel.
 *
 * Errors and error-shaped objects contribute their message, and anything else
 * is stringified. Terminal escape sequences are always stripped, because the
 * text ends up in a Vite overlay, a webpack report, or a CI annotation, where
 * colour codes render as noise around the file and line the reader needs.
 */
export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return stripTerminalEscapes(error.message);
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return stripTerminalEscapes(error.message);
  }
  return stripTerminalEscapes(String(error));
}
