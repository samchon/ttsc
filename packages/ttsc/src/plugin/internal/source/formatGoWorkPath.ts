import { autoQuoteGoModToken } from "./autoQuoteGoModToken";

/**
 * Format an absolute filesystem path as a single `go.work`/`go.mod` token.
 *
 * The modfile grammar shared by `go.mod` and `go.work` (parsed by
 * `golang.org/x/mod/modfile`) is whitespace-tokenized, so a `use`/`replace`
 * path that contains a space — a home or project directory such as `/Users/John
 * Smith/...` or `C:\Users\John Smith\...` — must be emitted as a quoted string
 * or `go` cannot parse the generated `go.work`. Normalize Windows separators to
 * `/` (the workspace convention) and then delegate to
 * {@link autoQuoteGoModToken}, which mirrors `modfile.AutoQuote`.
 *
 * Separator normalization is itself a quoting trigger. A Windows UNC
 * (`\\server\share\...`) or extended-length (`\\?\C:\...`) path normalizes into
 * a token that starts with `//`, and the modfile lexer reads `//` as a line
 * comment wherever it appears. Emitted bare, such a token turns its whole
 * `use`/`replace` line into a comment: `go` exits 0, reports nothing, and the
 * overlay module simply disappears from the workspace.
 *
 * Exported for unit tests.
 */
export function formatGoWorkPath(p: string): string {
  return autoQuoteGoModToken(p.replace(/\\/g, "/"));
}
