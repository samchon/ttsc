// unicorn/better-regex: rewrite regex literals into their shortest
// equivalent form (`[0-9]` -> `\d`, dedupe/sort character classes, collapse
// redundant quantifiers). Two branches mirror the upstream rule:
//
//   - Regex literals (`/[0-9]/`) run the full regexp-tree optimizer port in
//     regex_tree.go + regex_tree_optimizer.go, then report + autofix when the
//     optimized literal differs. Literals carrying the `u` or `v` flag are
//     skipped: regexp-tree does not handle Unicode/Unicode-sets mode well, so
//     upstream (and this port) leave them untouched.
//   - `new RegExp("pattern", "flags")` string constructors run the
//     clean-regexp table port in regex_clean.go and rewrite the string
//     argument in place. Regex-literal arguments (`new RegExp(/[0-9]/)`) are
//     handled by the literal branch on the inner node, not here.
//
// The one option, `sortCharacterClasses` (default true), maps to blacklisting
// regexp-tree's `charClassClassrangesMerge` transform when set to false.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/better-regex.md
package linthost

import (
  "encoding/json"
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

type unicornBetterRegex struct{}

// unicornBetterRegexOptions is the rule's public option object. A nil
// `SortCharacterClasses` keeps the upstream default (sort/merge enabled).
type unicornBetterRegexOptions struct {
  SortCharacterClasses *bool `json:"sortCharacterClasses"`
}

func (unicornBetterRegex) Name() string { return "unicorn/better-regex" }
func (unicornBetterRegex) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindRegularExpressionLiteral, shimast.KindNewExpression}
}

func (unicornBetterRegex) ValidateOptions(raw json.RawMessage) error {
  return validateUnicornBetterRegexOptions(raw)
}

func (unicornBetterRegex) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || node == nil {
    return
  }
  switch node.Kind {
  case shimast.KindRegularExpressionLiteral:
    unicornBetterRegexCheckLiteral(ctx, node)
  case shimast.KindNewExpression:
    unicornBetterRegexCheckConstructor(ctx, node)
  }
}

// unicornBetterRegexBlacklist decodes the `sortCharacterClasses` option and
// returns the regexp-tree transform blacklist it implies. Only an explicit
// `false` disables the class range merge/sort transform.
func unicornBetterRegexBlacklist(ctx *Context) map[string]bool {
  var options unicornBetterRegexOptions
  _ = ctx.DecodeOptions(&options)
  if options.SortCharacterClasses != nil && !*options.SortCharacterClasses {
    return map[string]bool{"charClassClassrangesMerge": true}
  }
  return nil
}

// validateUnicornBetterRegexOptions enforces the upstream schema: an optional
// object with a single boolean `sortCharacterClasses` and no other keys.
func validateUnicornBetterRegexOptions(raw json.RawMessage) error {
  if len(raw) == 0 {
    return nil
  }
  var fields map[string]json.RawMessage
  if err := json.Unmarshal(raw, &fields); err != nil {
    return fmt.Errorf("unicorn/better-regex options must be an object: %w", err)
  }
  for key, value := range fields {
    if key != "sortCharacterClasses" {
      return fmt.Errorf("unicorn/better-regex: unknown option %q", key)
    }
    var flag bool
    if err := json.Unmarshal(value, &flag); err != nil {
      return fmt.Errorf("unicorn/better-regex: sortCharacterClasses must be a boolean")
    }
  }
  return nil
}

// unicornBetterRegexCheckLiteral optimizes a regex literal and reports when the
// canonical form differs. The autofix replaces the whole literal token, except
// when the literal is the object of a non-optional `.source` / `.toString`
// member access — rewriting there could change a serialized-source consumer's
// expectations, so upstream reports without a fix.
func unicornBetterRegexCheckLiteral(ctx *Context, node *shimast.Node) {
  source := ctx.File.Text()
  start := shimscanner.SkipTrivia(source, node.Pos())
  end := node.End()
  if start < 0 || end > len(source) || start >= end {
    return
  }
  original := source[start:end]
  // regexp-tree mishandles `u` / `v` mode, so upstream skips those flags.
  flags := unicornBetterRegexLiteralFlags(original)
  if containsAnyByte(flags, "uv") {
    return
  }
  optimized, err := regexOptimizeLiteral(original, unicornBetterRegexBlacklist(ctx))
  if err != nil {
    // A literal TypeScript already tokenized should parse, but this port
    // covers a subset of regexp-tree; on any parse gap, decline rather than
    // emit a wrong diagnostic or fix.
    return
  }
  if optimized == original {
    return
  }
  message := fmt.Sprintf("%s can be optimized to %s.", original, optimized)
  if unicornBetterRegexIsSourceOrToString(node) {
    ctx.Report(node, message)
    return
  }
  ctx.ReportFix(node, message, TextEdit{Pos: start, End: end, Text: optimized})
}

// unicornBetterRegexCheckConstructor rewrites a `new RegExp("pattern", "flags")`
// string argument via the clean-regexp table. Only a bare `new RegExp(...)`
// with a string-literal first argument qualifies; a regex-literal argument is
// left to the literal branch, and non-`RegExp` / non-string forms are ignored.
func unicornBetterRegexCheckConstructor(ctx *Context, node *shimast.Node) {
  newExpr := node.AsNewExpression()
  if newExpr == nil || identifierText(newExpr.Expression) != "RegExp" {
    return
  }
  if newExpr.Arguments == nil || len(newExpr.Arguments.Nodes) < 1 {
    return
  }
  patternNode := newExpr.Arguments.Nodes[0]
  if patternNode == nil || patternNode.Kind != shimast.KindStringLiteral {
    return
  }
  oldPattern := stringLiteralText(patternNode)
  flags := ""
  if len(newExpr.Arguments.Nodes) >= 2 {
    if flagsNode := newExpr.Arguments.Nodes[1]; flagsNode != nil && flagsNode.Kind == shimast.KindStringLiteral {
      flags = stringLiteralText(flagsNode)
    }
  }
  newPattern := regexCleanRegexp(oldPattern, flags)
  if oldPattern == newPattern {
    return
  }
  source := ctx.File.Text()
  patternStart := shimscanner.SkipTrivia(source, patternNode.Pos())
  patternEnd := patternNode.End()
  if patternStart < 0 || patternEnd > len(source) || patternStart >= patternEnd {
    return
  }
  quote := source[patternStart]
  replacement := regexEscapeStringJsesc(newPattern, quote)
  ctx.ReportFix(
    node,
    fmt.Sprintf("%s can be optimized to %s.", oldPattern, newPattern),
    TextEdit{Pos: patternStart, End: patternEnd, Text: replacement},
  )
}

// unicornBetterRegexLiteralFlags returns the flag suffix of a `/pattern/flags`
// literal by locating the closing delimiter outside a character class, the
// same scan the literal parser uses.
func unicornBetterRegexLiteralFlags(literal string) string {
  runes := []rune(literal)
  if len(runes) < 2 || runes[0] != '/' {
    return ""
  }
  inClass := false
  for index := 1; index < len(runes); index++ {
    switch runes[index] {
    case '\\':
      index++
    case '[':
      inClass = true
    case ']':
      inClass = false
    case '/':
      if !inClass {
        return string(runes[index+1:])
      }
    }
  }
  return ""
}

// containsAnyByte reports whether s contains any byte listed in set.
func containsAnyByte(s, set string) bool {
  for index := 0; index < len(s); index++ {
    for j := 0; j < len(set); j++ {
      if s[index] == set[j] {
        return true
      }
    }
  }
  return false
}

// unicornBetterRegexIsSourceOrToString reports whether the regex literal is the
// object of a non-optional, non-computed `.source` or `.toString` member
// access, the one shape upstream reports without attaching a fix.
func unicornBetterRegexIsSourceOrToString(node *shimast.Node) bool {
  parent := node.Parent
  if parent == nil || parent.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  access := parent.AsPropertyAccessExpression()
  if access == nil || access.Expression != node || access.QuestionDotToken != nil {
    return false
  }
  switch identifierText(access.Name()) {
  case "source", "toString":
    return true
  }
  return false
}

func init() {
  Register(unicornBetterRegex{})
}
