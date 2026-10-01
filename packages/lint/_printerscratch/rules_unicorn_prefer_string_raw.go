// unicorn/prefer-string-raw: a string literal whose source spells a
// backslash as the escape `\\` is using escape syntax to represent a
// literal backslash. The same value, written through `String.raw` as a
// template literal, drops every backslash escape and reads as the literal
// text the author meant — particularly noticeable for Windows paths,
// regex source strings, and TeX-shaped snippets.
//
// AST-only: visit `KindStringLiteral` and
// `KindNoSubstitutionTemplateLiteral`. `\\` is invisible in a literal's
// cooked value, so both branches re-read the raw source bytes of the node
// and report only when a `String.raw` template would reproduce the value
// exactly. Upstream's autofix is not ported; the rule is report-only.
//
// String literals mirror upstream's `Literal` handler, which returns
// before reporting when
//
//   - the raw payload's last character is a backslash: a template cannot
//     end in one, it would escape the closing backtick;
//   - the raw payload holds no `\\` at all: no escape to drop;
//   - the raw payload holds a backtick or `${`: the template would
//     terminate early or interpolate;
//   - the literal spans more than one line;
//   - unescaping only `\\` and `\<quote>` out of the raw payload does not
//     reproduce the cooked value: some OTHER escape (`\t`, `\n`, a
//     unicode escape, an escaped non-delimiter quote, …) is present, and
//     `String.raw` would emit its source spelling verbatim instead of the
//     character it stands for, silently changing the value.
//
// No-substitution templates mirror upstream's `TemplateLiteral` handler:
// the quasi of a tagged template is skipped (the tag already observes the
// raw text), a raw payload equal to its cooked value has no escape to
// drop, a cooked value ending in a backslash cannot be respelled raw, and
// the raw payload must unescape — `\\` only, a template has no delimiter
// quote to escape — back to the cooked value. Multi-line templates stay
// reportable, unlike multi-line string literals: a template already
// carries its newlines literally. As in ESLint, the raw payload is read
// with CR / CRLF collapsed to LF, the same normalization the TypeScript
// scanner applies when it cooks a template token.
//
// Not ported: upstream also suppresses the report by POSITION
// (`isStringRawRestricted` — directive prologues, property keys, module
// specifiers, TypeScript literal types and enum members, …) and inside
// Jest inline snapshots. Of that list only JSX attribute values are
// covered here, and by value rather than by position: a JSX attribute
// string has no escape sequences, so its cooked text keeps the doubled
// backslash that the unescape above drops. Untagged template literals
// WITH substitutions are out of scope too; this rule only addresses the
// "single literal of fixed text" case.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-raw.md
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

const unicornPreferStringRawMessage = "Prefer `String.raw` for strings with backslash escapes."

type unicornPreferStringRaw struct{}

func (unicornPreferStringRaw) Name() string { return "unicorn/prefer-string-raw" }
func (unicornPreferStringRaw) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral}
}
func (unicornPreferStringRaw) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  switch node.Kind {
  case shimast.KindStringLiteral:
    unicornPreferStringRawCheckString(ctx, node)
  case shimast.KindNoSubstitutionTemplateLiteral:
    unicornPreferStringRawCheckTemplate(ctx, node)
  }
}

// unicornPreferStringRawCheckString reports a single-quoted or
// double-quoted literal whose `\\` escapes — and nothing else — separate
// its raw source from its value.
//
// A literal without a matching closing quote is an unterminated token the
// parser recovered from; there is no payload to respell, so it is left
// alone rather than sliced blindly.
func unicornPreferStringRawCheckString(ctx *Context, node *shimast.Node) {
  pos, end := tokenRange(ctx.File, node)
  if pos < 0 || end-pos < 2 {
    return
  }
  source := ctx.File.Text()
  quote := source[pos]
  if (quote != '\'' && quote != '"') || source[end-1] != quote {
    return
  }
  raw := source[pos+1 : end-1]
  if strings.HasSuffix(raw, `\`) ||
    !strings.Contains(raw, `\\`) ||
    strings.Contains(raw, "`") ||
    strings.Contains(raw, "${") {
    return
  }
  if shimscanner.GetECMALineOfPosition(ctx.File, pos) != shimscanner.GetECMALineOfPosition(ctx.File, end) {
    return
  }
  if unicornPreferStringRawUnescapeBackslash(raw, quote) != stringLiteralText(node) {
    return
  }
  ctx.Report(node, unicornPreferStringRawMessage)
}

// unicornPreferStringRawCheckTemplate reports an untagged
// no-substitution template whose `\\` escapes — and nothing else —
// separate its raw source from its cooked value, so prefixing it with
// `String.raw` keeps the value and drops the escapes.
func unicornPreferStringRawCheckTemplate(ctx *Context, node *shimast.Node) {
  if isTaggedTemplateQuasi(node) {
    return
  }
  pos, end := tokenRange(ctx.File, node)
  if pos < 0 || end-pos < 2 {
    return
  }
  source := ctx.File.Text()
  if source[pos] != '`' || source[end-1] != '`' {
    return
  }
  raw := normalizeTemplateRaw(source[pos+1 : end-1])
  cooked := stringLiteralText(node)
  if raw == cooked || strings.HasSuffix(cooked, `\`) {
    return
  }
  if unicornPreferStringRawUnescapeBackslash(raw, 0) != cooked {
    return
  }
  ctx.Report(node, unicornPreferStringRawMessage)
}

// unicornPreferStringRawUnescapeBackslash is upstream's
// `unescapeBackslash(text, quote)`:
//
//  text.replaceAll(new RegExp(String.raw`\\(?<escapedCharacter>[\\${quote}])`, "g"), "$<escapedCharacter>")
//
// It drops the backslash from `\\` and from an escaped delimiter quote,
// and leaves every other escape sequence spelled out exactly as written.
// The result therefore equals the literal's cooked value only when those
// two are the only escapes present — which is precisely when `String.raw`
// can respell the literal without changing it.
//
// `quote` is the delimiter byte (`'` or `"`), or 0 for a template, whose
// only escapable delimiter is the backslash itself. Scanning bytes is
// UTF-8 safe: `\` is ASCII and never appears inside a multi-byte
// sequence, so multi-byte and astral runes are copied through untouched.
// Matches are consumed left to right and never overlap, so a run of
// backslashes halves exactly as the global regular expression does.
func unicornPreferStringRawUnescapeBackslash(text string, quote byte) string {
  var unescaped strings.Builder
  for index := 0; index < len(text); index++ {
    character := text[index]
    if character == '\\' && index+1 < len(text) {
      if next := text[index+1]; next == '\\' || (quote != 0 && next == quote) {
        unescaped.WriteByte(next)
        index++
        continue
      }
    }
    unescaped.WriteByte(character)
  }
  return unescaped.String()
}

func init() {
  Register(unicornPreferStringRaw{})
}
