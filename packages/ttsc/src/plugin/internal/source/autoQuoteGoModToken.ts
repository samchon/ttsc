/**
 * Format a `go.mod`/`go.work` token using modfile's ASCII delimiter/comment
 * rules and Go double-quoted escape spellings. Clean tokens remain unchanged.
 * Printable categories come from the JavaScript runtime's Unicode tables,
 * rather than the selected Go toolchain's tables, so this is not a universal
 * byte-for-byte AutoQuote identity certificate across Unicode versions.
 *
 * Go token decoding requires Unicode scalar values. Malformed UTF-16 is not
 * validated here: a lone surrogate becomes a surrogate escape that Go rejects,
 * rather than a guaranteed lexer round-trip. Workspace consumers supply native
 * path strings; this formatter neither validates their existence nor repairs
 * malformed Unicode.
 *
 * @evidence contracts/common.md#principled-implementation The helpers use modfile ASCII delimiter/comment rules, runtime printable Unicode categories and Go escape spellings; the ASCII-delimiter branch tests whether that delimiter is the sole code unit. Unicode-table identity and malformed-UTF16 decoding are not certified.
 * @evidence contracts/common.md#clear-and-simple-design Quote selection, quoted emission and rune escaping remain separate private helpers under one token formatter.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Go grammar punctuation and control escapes are contract constants rather than consumer-specific path exceptions.
 * @evidence contracts/common.md#meaningful-documentation Owning prose explains clean-token preservation, comment/whitespace quoting, runtime Unicode-table dependence and the malformed-UTF16 limit; helper comments distinguish Go-style rules from universal cross-runtime identity.
 * @evidence contracts/performance.md#efficient-algorithms Selection and quoted emission each traverse at most the token's code points, using constant-time delimiter length checks rather than an additional full byte-length scan.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This formats one caller-provided token and does not coordinate a retained computation across requests.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The formatter retains no state or external resource after returning its string.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation autoQuoteGoModToken computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
 */
export function autoQuoteGoModToken(token: string): string {
  return mustQuoteGoModToken(token) ? goQuoteString(token) : token;
}

// Apply modfile.MustQuote's ASCII grammar with runtime Unicode categories to
// select quotation for a supplied JavaScript string.
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

// Emit Go-style quotes and escapes using JavaScript code-point iteration.
// Runtime-printable characters pass through; malformed surrogate escapes are
// not accepted by strconv.Unquote, as stated by the owning operation.
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

// strconv.IsPrint's category selection, using the runtime Unicode tables:
// ASCII space is the sole admitted spacing character.
const GO_PRINTABLE_RE = /^[\p{L}\p{M}\p{N}\p{P}\p{S}]$/u;

function isGoPrintable(ch: string): boolean {
  return ch === " " || GO_PRINTABLE_RE.test(ch);
}
