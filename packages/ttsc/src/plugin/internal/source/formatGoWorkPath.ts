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
 * @evidence contracts/common.md#principled-implementation Separator normalization precedes Go's token formatter so UNC and extended-length spellings containing a comment opener are quoted rather than dropped from the workspace.
 * @evidence contracts/common.md#clear-and-simple-design Path protocol spelling and token quoting are two explicit steps, sharing the same AutoQuote implementation as other modfile values.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Quoting responds to Go's actual lexer, including comment openers, rather than a growing list of known project path exceptions.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain space, UNC and extended-length paths and why a bare slash pair loses a workspace entry.
 * @evidence contracts/portability.md#os-neutral-implementation The helper converts Windows separators to Go workspace slash spelling, including UNC paths; literal POSIX backslashes remain a representation limitation of this cross-spelling formatter.
 * @evidence contracts/performance.md#efficient-algorithms One separator pass and the token formatter's linear quote passes make time and temporary string space proportional to path length.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This converts one supplied path token and owns no shared resolution or build computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only its returned token survives; no filesystem handle or process is acquired.
 */
export function formatGoWorkPath(p: string): string {
  return autoQuoteGoModToken(p.replace(/\\/g, "/"));
}
