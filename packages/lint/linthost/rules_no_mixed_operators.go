// noMixedOperators is a faithful port of ESLint's no-mixed-operators. It
// flags an unparenthesized binary sub-expression whose operator is mixed with
// a different operator from the SAME configured group, unless the two share a
// precedence and allowSamePrecedence is on. The classic gotcha is `a && b ||
// c`: readers expect left-to-right grouping, but `&&` binds tighter than `||`,
// so the parse is `(a && b) || c`. Wrapping the inner sub-expression in parens
// removes the ambiguity.
//
// The default groups mirror ESLint's DEFAULT_GROUPS — arithmetic, bitwise,
// comparison, logical, relational — and a mix is only reportable when both
// operators live in one group. So `a + b * c` (arithmetic × arithmetic,
// different precedence) IS flagged, while `a | b && c` (bitwise × logical,
// different groups) is NOT: the earlier port had this exactly backwards,
// pairing across groups and omitting arithmetic. Ternary ("?:") and coalesce
// ("??") are in no default group, so a mix involving either is only considered
// when a custom `groups` option lists it.
//
// Because the TypeScript AST models parentheses as explicit
// ParenthesizedExpression nodes, a wrapped inner expression (`(a && b) || c`)
// has a non-binary parent and is skipped without ESLint's token-level paren
// probe. The `groups` and `allowSamePrecedence` options are honored.
// https://eslint.org/docs/latest/rules/no-mixed-operators
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// noMixedOperatorsDefaultGroups mirrors ESLint's DEFAULT_GROUPS. Each inner
// slice is one precedence family; a mix is only reportable when both operators
// belong to the same family. "~" never appears as a binary operator token but
// is retained so the bitwise family matches ESLint's BITWISE_OPERATORS
// verbatim. Ternary and coalesce are intentionally absent.
var noMixedOperatorsDefaultGroups = [][]string{
  {"+", "-", "*", "/", "%", "**"},
  {"&", "|", "^", "~", "<<", ">>", ">>>"},
  {"==", "!=", "===", "!==", ">", ">=", "<", "<="},
  {"&&", "||"},
  {"in", "instanceof"},
}

// noMixedOperatorsTernarySymbol is the operator name ESLint assigns to a
// ConditionalExpression parent. No default group contains it.
const noMixedOperatorsTernarySymbol = "?:"

// noMixedOperatorsMemoKey caches the file-resolved options so the JSON option
// blob is decoded once per file instead of once per visited binary node.
type noMixedOperatorsMemoKey struct{}

// noMixedOperatorsResolved is the normalized option set for one file.
type noMixedOperatorsResolved struct {
  groups              [][]string
  allowSamePrecedence bool
}

// noMixedOperatorsOptions is the wire shape of the rule's single options
// object, mirroring ESLint's schema. A nil AllowSamePrecedence keeps the
// default (true); empty Groups falls back to the default groups.
type noMixedOperatorsOptions struct {
  Groups              [][]string `json:"groups"`
  AllowSamePrecedence *bool      `json:"allowSamePrecedence"`
}

type noMixedOperators struct{}

func (noMixedOperators) Name() string           { return "no-mixed-operators" }
func (noMixedOperators) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindBinaryExpression} }

func (noMixedOperators) Check(ctx *Context, node *shimast.Node) {
  parent := node.Parent
  if parent == nil {
    return
  }
  childOp, ok := noMixedOperatorsBinarySymbol(node)
  if !ok {
    return
  }
  parentOp, ok := noMixedOperatorsParentSymbol(parent)
  if !ok {
    return
  }
  // isMixedWithParent: a different operator. A parenthesized child has a
  // ParenthesizedExpression parent and never reaches here, so ESLint's
  // token-level parenthesization probe is unnecessary.
  if childOp == parentOp {
    return
  }

  resolved := noMixedOperatorsResolveOptions(ctx)
  // shouldIgnore: skip unless both operators share a group AND, when they do,
  // they differ in precedence (or allowSamePrecedence is off).
  if !noMixedOperatorsIncludesBothInAGroup(resolved.groups, childOp, parentOp) {
    return
  }
  if resolved.allowSamePrecedence &&
    shimast.GetExpressionPrecedence(node) == shimast.GetExpressionPrecedence(parent) {
    return
  }
  ctx.Report(node, "Unexpected mix of different operators. Wrap the inner expression in parentheses to make the grouping explicit.")
}

// noMixedOperatorsResolveOptions decodes and caches the file's options. The
// engine reuses one Context per (file, rule), so the memo is keyed on the
// shared per-file table; a Context built outside the engine (focused unit
// tests) has no memo and transparently re-decodes.
func noMixedOperatorsResolveOptions(ctx *Context) noMixedOperatorsResolved {
  if cached, ok := ctx.fileValue(noMixedOperatorsMemoKey{}); ok {
    return cached.(noMixedOperatorsResolved)
  }
  resolved := noMixedOperatorsResolved{
    groups:              noMixedOperatorsDefaultGroups,
    allowSamePrecedence: true,
  }
  var opts noMixedOperatorsOptions
  if err := ctx.DecodeOptions(&opts); err == nil {
    // ESLint's normalizeOptions treats a missing OR empty groups array as "use
    // the defaults"; a non-empty array replaces them wholesale.
    if len(opts.Groups) > 0 {
      resolved.groups = opts.Groups
    }
    if opts.AllowSamePrecedence != nil {
      resolved.allowSamePrecedence = *opts.AllowSamePrecedence
    }
  }
  ctx.setFileValue(noMixedOperatorsMemoKey{}, resolved)
  return resolved
}

// noMixedOperatorsBinarySymbol returns the ESLint operator name for a binary
// expression node, reporting false when the node is not a binary expression
// carrying a recognized operator token.
func noMixedOperatorsBinarySymbol(node *shimast.Node) (string, bool) {
  if node == nil || node.Kind != shimast.KindBinaryExpression {
    return "", false
  }
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil {
    return "", false
  }
  symbol := noMixedOperatorsOperatorSymbol(expr.OperatorToken.Kind)
  return symbol, symbol != ""
}

// noMixedOperatorsParentSymbol returns the operator name of a candidate parent.
// A binary parent contributes its operator; a conditional parent contributes
// "?:". Any other parent — a ParenthesizedExpression wrapping the child, a
// statement, a call argument — means the child is not mixed with an operator,
// so it reports false and the mix is skipped.
func noMixedOperatorsParentSymbol(parent *shimast.Node) (string, bool) {
  switch parent.Kind {
  case shimast.KindBinaryExpression:
    return noMixedOperatorsBinarySymbol(parent)
  case shimast.KindConditionalExpression:
    return noMixedOperatorsTernarySymbol, true
  }
  return "", false
}

// noMixedOperatorsIncludesBothInAGroup mirrors ESLint's includesBothInAGroup:
// true when some group contains both operator names.
func noMixedOperatorsIncludesBothInAGroup(groups [][]string, left, right string) bool {
  for _, group := range groups {
    if noMixedOperatorsGroupContains(group, left) && noMixedOperatorsGroupContains(group, right) {
      return true
    }
  }
  return false
}

func noMixedOperatorsGroupContains(group []string, symbol string) bool {
  for _, member := range group {
    if member == symbol {
      return true
    }
  }
  return false
}

// noMixedOperatorsOperatorSymbol maps a binary operator token kind to the
// operator name ESLint uses in its group arrays. Unrecognized kinds
// (assignments, comma, unmapped keywords) return "" and so belong to no group.
func noMixedOperatorsOperatorSymbol(kind shimast.Kind) string {
  switch kind {
  case shimast.KindPlusToken:
    return "+"
  case shimast.KindMinusToken:
    return "-"
  case shimast.KindAsteriskToken:
    return "*"
  case shimast.KindSlashToken:
    return "/"
  case shimast.KindPercentToken:
    return "%"
  case shimast.KindAsteriskAsteriskToken:
    return "**"
  case shimast.KindAmpersandToken:
    return "&"
  case shimast.KindBarToken:
    return "|"
  case shimast.KindCaretToken:
    return "^"
  case shimast.KindLessThanLessThanToken:
    return "<<"
  case shimast.KindGreaterThanGreaterThanToken:
    return ">>"
  case shimast.KindGreaterThanGreaterThanGreaterThanToken:
    return ">>>"
  case shimast.KindEqualsEqualsToken:
    return "=="
  case shimast.KindExclamationEqualsToken:
    return "!="
  case shimast.KindEqualsEqualsEqualsToken:
    return "==="
  case shimast.KindExclamationEqualsEqualsToken:
    return "!=="
  case shimast.KindGreaterThanToken:
    return ">"
  case shimast.KindGreaterThanEqualsToken:
    return ">="
  case shimast.KindLessThanToken:
    return "<"
  case shimast.KindLessThanEqualsToken:
    return "<="
  case shimast.KindAmpersandAmpersandToken:
    return "&&"
  case shimast.KindBarBarToken:
    return "||"
  case shimast.KindInKeyword:
    return "in"
  case shimast.KindInstanceOfKeyword:
    return "instanceof"
  case shimast.KindQuestionQuestionToken:
    return "??"
  }
  return ""
}

func init() { Register(noMixedOperators{}) }
