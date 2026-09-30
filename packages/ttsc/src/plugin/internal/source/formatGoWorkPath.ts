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
 * On POSIX, a backslash can be part of a filename. Preserve it there so the
 * workspace token continues to name the directory the caller supplied.
 * The explicit platform argument permits callers to format a declared path
 * grammar; ordinary workspace callers retain the current host by default.
 *
 * @evidence contracts/common.md#principled-implementation Windows separator normalization precedes Go's token formatter so UNC and extended-length spellings containing a comment opener are quoted rather than dropped from the workspace; POSIX backslashes retain their filename meaning.
 * @evidence contracts/common.md#clear-and-simple-design Path protocol spelling and token quoting are two explicit steps, sharing the same AutoQuote implementation as other modfile values.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Quoting responds to Go's actual lexer, including comment openers, rather than a growing list of known project path exceptions.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain space, UNC and extended-length paths, why a bare slash pair loses a workspace entry, and why POSIX backslashes are preserved.
 * @evidence contracts/portability.md#os-neutral-implementation The host path grammar selects separator conversion: Windows backslashes become Go workspace slashes, including UNC paths, while POSIX backslashes remain literal filename characters.
 * @evidence contracts/performance.md#efficient-algorithms At most one separator pass and the token formatter's linear quote passes make time and temporary string space proportional to path length.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This converts one supplied path token and owns no shared resolution or build computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only its returned token survives; no filesystem handle or process is acquired.
 */
export function formatGoWorkPath(
  p: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return autoQuoteGoModToken(
    platform === "win32" ? p.replace(/\\/g, "/") : p,
  );
}
