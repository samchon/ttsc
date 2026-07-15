// unicorn/no-typeof-undefined: comparing `typeof X` against the string literal
// `"undefined"` is a leftover guard from pre-strict-mode code, when referencing
// an undeclared identifier threw a ReferenceError. Modern code can compare the
// value to `undefined` directly, which is shorter and reads as the intent it
// actually expresses.
//
// The match mirrors upstream exactly:
//
//   - the `typeof` must be the LEFT operand of `===` / `==` / `!==` / `!=`
//     (a reversed `"undefined" === typeof x` is left alone),
//   - the right operand must be a string Literal whose value is `undefined`
//     (a template literal “ `undefined` “ is a TemplateLiteral, never a
//     Literal, so it is excluded), and
//   - a global operand is skipped unless `checkGlobalVariables` is enabled,
//     because rewriting `typeof window === "undefined"` to `window ===
//     undefined` throws a ReferenceError when the global is undeclared. A
//     global is an identifier that resolves to no local binding, which the
//     checker answers; every other operand (member access, call, `this`,
//     literal) is never a global identifier and stays checked.
//
// The autofix removes the `typeof` keyword, upgrades `==` / `!=` to their
// strict form, and replaces the `"undefined"` literal with the `undefined`
// identifier. Removing a leading keyword can create an ASI hazard, so the fix
// is declined (the diagnostic still reports) when `typeof` and its operand span
// different lines or the operand begins with a continuation character; upstream
// inserts a guarding `;` or parentheses there, which this port conservatively
// avoids emitting rather than risk a wrong edit. When `checkGlobalVariables`
// surfaces a global, the same edits are offered as an opt-in suggestion instead
// of an automatic fix, matching upstream.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-typeof-undefined.md
package linthost

import (
  "bytes"
  "encoding/json"
  "errors"
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

type unicornNoTypeofUndefined struct{ optionsRule }

// unicornNoTypeofUndefinedOptions is the decoded option payload. Upstream's
// only option is `checkGlobalVariables`, defaulting to false.
type unicornNoTypeofUndefinedOptions struct {
  checkGlobalVariables bool
}

func (unicornNoTypeofUndefined) Name() string { return "unicorn/no-typeof-undefined" }
func (unicornNoTypeofUndefined) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression}
}

// The global guard is scope analysis, not syntax: resolving the operand to its
// binding is what separates a shadowing `let window` (checked) from the
// ambient `window` global (skipped by default).
func (unicornNoTypeofUndefined) NeedsTypeChecker() bool { return true }

func (unicornNoTypeofUndefined) ValidateOptions(raw json.RawMessage) error {
  _, err := decodeUnicornNoTypeofUndefinedOptions(raw)
  return err
}

func (unicornNoTypeofUndefined) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || ctx.Checker == nil || node == nil {
    return
  }
  options, err := decodeUnicornNoTypeofUndefinedOptions(ctx.Options)
  if err != nil {
    return
  }
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil || expr.Left == nil || expr.Right == nil {
    return
  }
  switch expr.OperatorToken.Kind {
  case shimast.KindEqualsEqualsEqualsToken,
    shimast.KindEqualsEqualsToken,
    shimast.KindExclamationEqualsEqualsToken,
    shimast.KindExclamationEqualsToken:
  default:
    return
  }
  // Upstream requires `binaryExpression.left` to be the `typeof` unary; the
  // reversed operand order is one of its explicit valid cases.
  if expr.Left.Kind != shimast.KindTypeOfExpression {
    return
  }
  // `isLiteral(right, 'undefined')` matches an ESTree Literal only. A
  // NoSubstitutionTemplateLiteral is a TemplateLiteral, so it never matches.
  if expr.Right.Kind != shimast.KindStringLiteral {
    return
  }
  if lit := expr.Right.AsStringLiteral(); lit == nil || lit.Text != "undefined" {
    return
  }

  typeofExpr := expr.Left.AsTypeOfExpression()
  if typeofExpr == nil || typeofExpr.Expression == nil {
    return
  }
  // Parentheses are elided in ESTree, so `typeof (foo)` reads through to `foo`
  // for the global-identifier test.
  operand := stripParens(typeofExpr.Expression)
  isGlobal := unicornNoTypeofUndefinedIsGlobal(ctx, operand)
  if isGlobal && !options.checkGlobalVariables {
    return
  }

  text := ctx.File.Text()
  typeofStart := shimscanner.SkipTrivia(text, expr.Left.Pos())
  const typeofKeyword = "typeof"
  typeofEnd := typeofStart + len(typeofKeyword)
  if typeofStart < 0 || typeofEnd > len(text) || text[typeofStart:typeofEnd] != typeofKeyword {
    return
  }

  const message = "Compare with `undefined` directly instead of using `typeof`."
  edits, safe := unicornNoTypeofUndefinedFix(text, expr, typeofExpr, typeofStart, typeofEnd)
  if !safe {
    ctx.ReportRange(typeofStart, typeofEnd, message)
    return
  }
  if isGlobal {
    // Reachable only under checkGlobalVariables. Rewriting a global can throw,
    // so upstream advertises an opt-in suggestion rather than an autofix.
    ctx.ReportRangeSuggestion(
      typeofStart,
      typeofEnd,
      message,
      unicornNoTypeofUndefinedSuggestionTitle(expr.OperatorToken.Kind),
      edits...,
    )
    return
  }
  ctx.ReportRangeFix(typeofStart, typeofEnd, message, edits...)
}

// decodeUnicornNoTypeofUndefinedOptions parses the `checkGlobalVariables`
// option. An absent payload keeps the upstream default (false); an unknown key,
// a non-object payload, or a non-boolean value is rejected so a malformed
// config fails loudly instead of silently defaulting.
func decodeUnicornNoTypeofUndefinedOptions(raw json.RawMessage) (unicornNoTypeofUndefinedOptions, error) {
  options := unicornNoTypeofUndefinedOptions{}
  trimmed := bytes.TrimSpace(raw)
  if len(trimmed) == 0 {
    return options, nil
  }
  if trimmed[0] != '{' {
    return options, errors.New("options must be an object")
  }
  var rawFields map[string]json.RawMessage
  if err := json.Unmarshal(trimmed, &rawFields); err != nil {
    return options, fmt.Errorf("options must be an object: %w", err)
  }
  for name := range rawFields {
    if name != "checkGlobalVariables" {
      return options, fmt.Errorf("unknown option %q", name)
    }
  }
  if value, ok := rawFields["checkGlobalVariables"]; ok {
    if bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
      return options, errors.New(`option "checkGlobalVariables" must be a boolean`)
    }
    if err := json.Unmarshal(value, &options.checkGlobalVariables); err != nil {
      return options, fmt.Errorf(`option "checkGlobalVariables" must be a boolean: %w`, err)
    }
  }
  return options, nil
}

// unicornNoTypeofUndefinedIsGlobal ports upstream's `isGlobalIdentifier`: an
// identifier that resolves to no local binding — either unresolved (an implicit
// global) or declared only outside this file (a lib/ambient global). Any other
// operand shape (member access, call, `this`, a literal) is never a global
// identifier and returns false so it stays checked.
func unicornNoTypeofUndefinedIsGlobal(ctx *Context, operand *shimast.Node) bool {
  if operand == nil || operand.Kind != shimast.KindIdentifier {
    return false
  }
  symbol := ctx.Checker.GetSymbolAtLocation(operand)
  if symbol == nil {
    return true
  }
  for _, declaration := range symbol.Declarations {
    if declaration == nil {
      continue
    }
    if shimast.GetSourceFileOfNode(declaration) == ctx.File {
      return false
    }
  }
  return true
}

// unicornNoTypeofUndefinedFix builds the upstream autofix edits and reports
// whether they are safe to apply. The three edits — remove `typeof` plus the
// whitespace after it, upgrade `==`/`!=`, and replace the literal — reproduce
// upstream's non-hazard rewrite. Removing the leading `typeof` is declined
// (safe=false) when the operand sits on a different line than `typeof` or
// begins with an ASI-continuation character, the two shapes where upstream
// instead emits a guarding `;` or wrapping parentheses.
func unicornNoTypeofUndefinedFix(
  text string,
  expr *shimast.BinaryExpression,
  typeofExpr *shimast.TypeOfExpression,
  typeofStart, typeofEnd int,
) ([]TextEdit, bool) {
  operandStart := shimscanner.SkipTrivia(text, typeofExpr.Expression.Pos())
  if operandStart < typeofEnd || operandStart >= len(text) {
    return nil, false
  }
  // (A) A line break between `typeof` and its operand (a newline or a
  // multi-line comment) risks ASI once `typeof` is gone, notably inside a
  // `return`/`throw` argument.
  if bytes.ContainsAny([]byte(text[typeofEnd:operandStart]), "\n\r") {
    return nil, false
  }
  // (B) An operand that begins with a continuation character could merge with a
  // preceding token: `foo⏎typeof [] === "undefined"` would become `foo⏎[] ===
  // undefined`, i.e. `foo[]`.
  switch text[operandStart] {
  case '[', '(', '`', '+', '-', '*', '/', ',', '.':
    return nil, false
  }

  edits := make([]TextEdit, 0, 3)
  // Drop `typeof` and the whitespace run that follows it, mirroring
  // `fixer.remove(typeofToken)` + `removeSpacesAfter(typeofToken)`. The run
  // stops at the operand or an intervening comment, so a same-line comment is
  // preserved rather than deleted.
  removeEnd := typeofEnd
  for removeEnd < len(text) && (text[removeEnd] == ' ' || text[removeEnd] == '\t') {
    removeEnd++
  }
  edits = append(edits, TextEdit{Pos: typeofStart, End: removeEnd, Text: ""})

  if expr.OperatorToken.Kind == shimast.KindEqualsEqualsToken ||
    expr.OperatorToken.Kind == shimast.KindExclamationEqualsToken {
    edits = append(edits, TextEdit{
      Pos:  expr.OperatorToken.End(),
      End:  expr.OperatorToken.End(),
      Text: "=",
    })
  }

  literalStart := shimscanner.SkipTrivia(text, expr.Right.Pos())
  edits = append(edits, TextEdit{Pos: literalStart, End: expr.Right.End(), Text: "undefined"})
  return edits, true
}

// unicornNoTypeofUndefinedSuggestionTitle renders upstream's suggestion label,
// whose operator is `!==` for a negated comparison and `===` otherwise.
func unicornNoTypeofUndefinedSuggestionTitle(operator shimast.Kind) string {
  replacement := "==="
  if operator == shimast.KindExclamationEqualsEqualsToken ||
    operator == shimast.KindExclamationEqualsToken {
    replacement = "!=="
  }
  return "Switch to `… " + replacement + " undefined`."
}

func init() {
  Register(unicornNoTypeofUndefined{})
}
