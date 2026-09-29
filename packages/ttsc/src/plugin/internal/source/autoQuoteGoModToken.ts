/**
 * Quote `token` for a `go.mod`/`go.work` line exactly as
 * `golang.org/x/mod/modfile`'s `AutoQuote` does: return it unchanged when it is
 * already a clean bare token, otherwise return its Go double-quoted form so the
 * value round-trips through the modfile lexer. A clean bare token is therefore
 * emitted byte-for-byte as before; only tokens that would otherwise be split or
 * interpreted as comments are quoted.
 *
 * @evidence contracts/common.md#principled-implementation The helpers reproduce modfile.MustQuote and strconv.Quote using printable Unicode categories and Go escape spellings; the ASCII-delimiter branch tests whether that delimiter is the sole code unit.
 * @evidence contracts/common.md#clear-and-simple-design Quote selection, quoted emission and rune escaping remain separate private helpers under one token formatter.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Go grammar punctuation and control escapes are contract constants rather than consumer-specific path exceptions.
 * @evidence contracts/common.md#meaningful-documentation Owning prose explains clean-token preservation and comment/whitespace quoting; helper comments state the authoritative Go operations they mirror.
 * @evidence contracts/performance.md#efficient-algorithms Selection and quoted emission each traverse at most the token's code points, using constant-time delimiter length checks rather than an additional full byte-length scan.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This formats one caller-provided token and does not coordinate a retained computation across requests.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The formatter retains no state or external resource after returning its string.
 */
export function autoQuoteGoModToken(token: string): string {
  return mustQuoteGoModToken(token) ? goQuoteString(token) : token;
}

// Mirror `modfile.MustQuote`: report whether `s` must be quoted to appear as a
// single token on a modfile line.
function mustQuoteGoModToken(s: string): boolean {
  for (const ch of s) {
    if (ch === " " || ch === '"' || ch === "'" || ch === "`") {
      return true;
    }
    if (
      ch === "(" ||
      ch === ")" ||
      ch === "[" ||
      ch === "]" ||
      ch === "{" ||
      ch === "}" ||
      ch === ","
    ) {
      // This branch has already found an ASCII bracket/comma. It is the whole
      // UTF-8 token exactly when it is the sole UTF-16 code unit, so no full
      // byte-length scan is needed to mirror Go's len(s) > 1 decision.
      if (s.length > 1) {
        return true;
      }
      continue;
    }
    if (!isGoPrintable(ch)) {
      return true;
    }
  }
  return s === "" || s.includes("//") || s.includes("/*");
}

// Mirror `strconv.Quote`: wrap in double quotes, backslash-escape `"` and `\`,
// emit Go-printable runes verbatim (including the ASCII space and printable
// Unicode), and escape everything else with Go's `\a\b\f\n\r\t\v` / `\xNN` /
// `\uNNNN` / `\UNNNNNNNN` forms so the token round-trips through
// `strconv.Unquote` in the modfile lexer.
function goQuoteString(s: string): string {
  let out = '"';
  for (const ch of s) {
    if (ch === '"' || ch === "\\") {
      out += `\\${ch}`;
      continue;
    }
    if (isGoPrintable(ch)) {
      out += ch;
      continue;
    }
    out += escapeGoRune(ch);
  }
  return `${out}"`;
}

function escapeGoRune(ch: string): string {
  switch (ch) {
    case "\x07":
      return "\\a";
    case "\b":
      return "\\b";
    case "\f":
      return "\\f";
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "\t":
      return "\\t";
    case "\v":
      return "\\v";
    default: {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp < 0x20 || cp === 0x7f) {
        return `\\x${cp.toString(16).padStart(2, "0")}`;
      }
      if (cp < 0x10000) {
        return `\\u${cp.toString(16).padStart(4, "0")}`;
      }
      return `\\U${cp.toString(16).padStart(8, "0")}`;
    }
  }
}

// `strconv.IsPrint`: the graphic categories except that the ONLY spacing
// character is the ASCII space (U+0020); other Unicode spaces are escaped.
const GO_PRINTABLE_RE = /^[\p{L}\p{M}\p{N}\p{P}\p{S}]$/u;

function isGoPrintable(ch: string): boolean {
  return ch === " " || GO_PRINTABLE_RE.test(ch);
}
