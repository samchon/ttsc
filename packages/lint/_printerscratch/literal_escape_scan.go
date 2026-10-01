// Raw-source scanning for the numeric escape sequences (`\xHH`, `\uHHHH`,
// `\u{HEX...}`) that `unicorn/no-hex-escape` and `unicorn/escape-case`
// police. Both rules read the raw literal source — the parser already
// decodes escapes into the `.Text` value, so a normal accessor would see
// `©` instead of `\xA9` — and both therefore need the same two guards a
// regex port cannot express in RE2:
//
//   - Backslash parity: only a backslash preceded by an even-length
//     backslash run opens an escape. Upstream spells this as the
//     lookbehind `(?<=(?:^|[^\\])(?:\\\\)*\\)` and, in its byte-scanning
//     rules, as `isActiveBackslash`. Without it, the second backslash of
//     an escaped `\\` donates itself to a bogus match and `"\\x64"` (a
//     backslash followed by the literal text `x64`) reports.
//   - Fixed-width digit runs: `\x` takes exactly two hex digits and `\u`
//     exactly four, so an escape never absorbs the literal hex-looking
//     characters that follow it (`"\x41bcd"` is a canonical `\x41` plus
//     the letters `bcd`). Only the braced `\u{HEX...}` form is variable
//     width, and its `}` terminates it.
//
// Byte scanning is UTF-8 safe: every byte the scanner tests is ASCII, and
// a multi-byte sequence contains no ASCII bytes.
package linthost

// literalEscape is one numeric escape sequence found in raw literal source.
// `Prefix` is the character introducing it (`x` for `\xHH`, `u` for both
// `\uHHHH` and `\u{HEX...}`) and `Digits` is its hex payload with the `\u{`
// / `}` brackets stripped.
type literalEscape struct {
  Prefix byte
  Digits string
}

// hasActiveLiteralEscape reports whether `text` contains an escape sequence
// accepted by `match` whose backslash is active — preceded by an even-length
// run of backslashes.
//
// `text` is the raw source of one string literal or template element token,
// delimiters included. Including them changes nothing: a quote, backtick,
// `}`, or `${` is never a backslash, so the parity of every run inside the
// payload is the same as it would be for the delimiter-free raw value
// upstream reads off `TemplateElement.value.raw`.
func hasActiveLiteralEscape(text string, match func(escape literalEscape) bool) bool {
  for index := 0; index < len(text); {
    if text[index] != '\\' {
      index++
      continue
    }
    run := 0
    for index < len(text) && text[index] == '\\' {
      run++
      index++
    }
    // An even-length run is a sequence of escaped backslashes: each one
    // consumes the next, none is left over to open an escape, and the text
    // behind the run is literal. Only the last backslash of an odd-length
    // run is active, and it opens the escape at `index`.
    if run%2 == 0 {
      continue
    }
    if escape, ok := literalEscapeAt(text[index:]); ok && match(escape) {
      return true
    }
    // `text[index]` is the escaped character, never a backslash (the run
    // above consumed every one), so the outer loop may step over it.
  }
  return false
}

// literalEscapeAt parses the escape sequence opened at `text[0]`, the byte
// right after an active backslash. It recognizes exactly the three numeric
// forms of upstream's `x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|u{[\dA-Fa-f]+}`
// alternation; any other escape (`\n`, `\\`, `\$`, a line continuation, an
// identifier escape) is not a numeric escape and fails the parse.
func literalEscapeAt(text string) (literalEscape, bool) {
  if text == "" {
    return literalEscape{}, false
  }
  switch text[0] {
  case 'x':
    if digits, ok := literalEscapeDigits(text[1:], 2); ok {
      return literalEscape{Prefix: 'x', Digits: digits}, true
    }
  case 'u':
    // The braced form is the only variable-width escape. `{` is not a hex
    // digit, so the fixed-width `\uHHHH` form can never match here and the
    // brace branch owns the decision.
    if len(text) > 1 && text[1] == '{' {
      end := 2
      for end < len(text) && hexDigit(text[end]) >= 0 {
        end++
      }
      if end == 2 || end >= len(text) || text[end] != '}' {
        return literalEscape{}, false
      }
      return literalEscape{Prefix: 'u', Digits: text[2:end]}, true
    }
    if digits, ok := literalEscapeDigits(text[1:], 4); ok {
      return literalEscape{Prefix: 'u', Digits: digits}, true
    }
  }
  return literalEscape{}, false
}

// literalEscapeDigits returns the first `count` bytes of `text` when every
// one of them is a hex digit — the fixed-width digit run of a `\xHH` or
// `\uHHHH` escape.
func literalEscapeDigits(text string, count int) (string, bool) {
  if len(text) < count {
    return "", false
  }
  for index := 0; index < count; index++ {
    if hexDigit(text[index]) < 0 {
      return "", false
    }
  }
  return text[:count], true
}
