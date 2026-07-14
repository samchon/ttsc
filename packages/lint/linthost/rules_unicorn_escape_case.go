// unicorn/escape-case: numeric escape sequences inside string and
// template literals (`\xHH`, `\uHHHH`, `\u{HEX...}`) are case-insensitive
// to the engine but read inconsistently across a codebase when authors
// mix `\xa9` and `\xA9`. Canonical form uses uppercase hex digits; the
// rule fires when any hex escape's A-F digits are lowercase.
//
// AST-only: visit `KindStringLiteral`, `KindNoSubstitutionTemplateLiteral`,
// and the `KindTemplateHead`/`Middle`/`Tail` elements an interpolated
// template (or a template literal type) is built from, read each token's raw
// source text via `nodeText` (the parser already decodes escapes into the
// `.Text` value), and fire when an active escape's hex digits contain an a-f
// letter. The scan is hex-only — `\n` and other identifier escapes are
// untouched — and tagged templates are skipped because their tag observes
// the raw text, where the two spellings differ. See
// `literal_escape_scan.go` for the parity and digit-width rules the scan
// enforces.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/escape-case.md
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornEscapeCase struct{}

func (unicornEscapeCase) Name() string { return "unicorn/escape-case" }
func (unicornEscapeCase) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindStringLiteral,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindTemplateHead,
    shimast.KindTemplateMiddle,
    shimast.KindTemplateTail,
  }
}
func (unicornEscapeCase) Check(ctx *Context, node *shimast.Node) {
  if isTaggedTemplateElement(node) {
    return
  }
  source := nodeText(ctx.File, node)
  if source == "" {
    return
  }
  if hasActiveLiteralEscape(source, unicornEscapeCaseIsLowercase) {
    ctx.Report(node, "Use uppercase letters for escape sequence hex digits (`\\xA9` over `\\xa9`).")
  }
}

// unicornEscapeCaseIsLowercase selects an escape whose hex digits carry at
// least one lowercase a-f letter — exactly the escapes upstream's uppercasing
// replacement would rewrite. Digits `0`-`9` and `A`-`F` are already canonical,
// and the `\u{...}` brackets are not part of `Digits`.
func unicornEscapeCaseIsLowercase(escape literalEscape) bool {
  return strings.ContainsAny(escape.Digits, "abcdef")
}

func init() {
  Register(unicornEscapeCase{})
}
