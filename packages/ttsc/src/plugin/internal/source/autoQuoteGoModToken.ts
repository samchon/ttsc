/**
 * Quote `token` for a `go.mod`/`go.work` line exactly as
 * `golang.org/x/mod/modfile`'s `AutoQuote` does: return it unchanged when it is
 * already a clean bare token, otherwise return its Go double-quoted form so the
 * value round-trips through the modfile lexer. A clean bare token is therefore
 * emitted byte-for-byte as before; only tokens that would otherwise be split or
 * interpreted as comments are quoted.
 *
 * Exported for unit tests.
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
      // Go tests `len(s) > 1` (byte length): a lone bracket/comma is a legal
      // bare token, but one embedded in a longer token forces quoting.
      if (Buffer.byteLength(s, "utf8") > 1) {
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
