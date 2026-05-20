package strip

import (
  "fmt"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

func init() {
  driver.RegisterPlugin(plugin{})
}

// plugin implements driver.ProgramPlugin for @ttsc/strip.
type plugin struct{}

// ApplyProgram strips configured call expressions and debugger statements from
// every source file in the program.
func (plugin) ApplyProgram(prog *driver.Program, ctx driver.PluginContext) error {
  rewriter, err := parseStrip(ctx.Entry.Config)
  if err != nil {
    return err
  }
  for _, file := range prog.SourceFiles() {
    rewriter.apply(file)
  }
  return nil
}

// stripRewriter holds the resolved strip configuration for a single build.
type stripRewriter struct {
  calls         []callPattern
  stripDebugger bool
}

// callPattern represents a parsed call-expression stripping rule such as
// "console.log" (exact) or "assert.*" (wildcard prefix).
type callPattern struct {
  parts    []string
  wildcard bool
}

// parseStrip builds a stripRewriter from the plugin config map. When neither
// "calls" nor "statements" is present the default configuration is applied:
// strip console.log, console.debug, assert.*, and debugger statements.
func parseStrip(config map[string]any) (*stripRewriter, error) {
  _, hasCalls := config["calls"]
  _, hasStatements := config["statements"]
  if !hasCalls && !hasStatements {
    config = map[string]any{
      "calls":      []any{"console.log", "console.debug", "assert.*"},
      "statements": []any{"debugger"},
    }
  }
  calls, err := stringArrayConfig(config, "calls")
  if err != nil {
    return nil, fmt.Errorf("@ttsc/strip: %w", err)
  }
  statements, err := stringArrayConfig(config, "statements")
  if err != nil {
    return nil, fmt.Errorf("@ttsc/strip: %w", err)
  }
  out := &stripRewriter{}
  for _, call := range calls {
    pattern, err := parseCallPattern(call)
    if err != nil {
      return nil, fmt.Errorf("@ttsc/strip: %w", err)
    }
    out.calls = append(out.calls, pattern)
  }
  for _, statement := range statements {
    switch statement {
    case "debugger":
      out.stripDebugger = true
    default:
      return nil, fmt.Errorf("@ttsc/strip: unsupported statement pattern %q", statement)
    }
  }
  return out, nil
}

// apply removes matching statements from file's top-level statement list.
func (s *stripRewriter) apply(file *shimast.SourceFile) {
  if s == nil || file == nil || (len(s.calls) == 0 && !s.stripDebugger) {
    return
  }
  filterStatements(file.Statements, s)
}

// filterStatements removes stripped statements from list in-place, preserving
// order. Children of retained statements are recursively filtered.
func filterStatements(list *shimast.NodeList, strip *stripRewriter) {
  if list == nil || len(list.Nodes) == 0 {
    return
  }
  out := make([]*shimast.Node, 0, len(list.Nodes))
  for _, stmt := range list.Nodes {
    if shouldStripStatement(stmt, strip) {
      continue
    }
    filterChildStatements(stmt, strip)
    out = append(out, stmt)
  }
  list.Nodes = out
}

// filterChildStatements recurses into node's children, filtering embedded
// single-statement bodies (if, while, for, etc.) and nested statement lists.
func filterChildStatements(node *shimast.Node, strip *stripRewriter) {
  if node == nil {
    return
  }
  filterEmbeddedStatements(node, strip)
  if node.CanHaveStatements() {
    filterStatements(node.StatementList(), strip)
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    filterChildStatements(child, strip)
    return false
  })
}

// filterEmbeddedStatements handles statement nodes that embed a single child
// statement (if/else, do, while, for, with, labeled). A stripped child is
// replaced with an empty synthesized statement to preserve the AST shape.
func filterEmbeddedStatements(node *shimast.Node, strip *stripRewriter) {
  switch node.Kind {
  case shimast.KindIfStatement:
    stmt := node.AsIfStatement()
    stmt.ThenStatement = filterEmbeddedStatement(stmt.ThenStatement, strip)
    stmt.ElseStatement = filterEmbeddedStatement(stmt.ElseStatement, strip)
  case shimast.KindDoStatement:
    stmt := node.AsDoStatement()
    stmt.Statement = filterEmbeddedStatement(stmt.Statement, strip)
  case shimast.KindWhileStatement:
    stmt := node.AsWhileStatement()
    stmt.Statement = filterEmbeddedStatement(stmt.Statement, strip)
  case shimast.KindForStatement:
    stmt := node.AsForStatement()
    stmt.Statement = filterEmbeddedStatement(stmt.Statement, strip)
  case shimast.KindForInStatement, shimast.KindForOfStatement:
    stmt := node.AsForInOrOfStatement()
    stmt.Statement = filterEmbeddedStatement(stmt.Statement, strip)
  case shimast.KindWithStatement:
    stmt := node.AsWithStatement()
    stmt.Statement = filterEmbeddedStatement(stmt.Statement, strip)
  case shimast.KindLabeledStatement:
    stmt := node.AsLabeledStatement()
    stmt.Statement = filterEmbeddedStatement(stmt.Statement, strip)
  }
}

// filterEmbeddedStatement strips or recurses into a single embedded statement.
// Returns an empty synthesized statement when stmt is to be stripped, preserving
// the original source location for downstream source-map accuracy.
func filterEmbeddedStatement(stmt *shimast.Statement, strip *stripRewriter) *shimast.Statement {
  if stmt == nil {
    return nil
  }
  if shouldStripStatement(stmt, strip) {
    return emptyStatement(stmt)
  }
  filterChildStatements(stmt, strip)
  return stmt
}

// emptyStatement creates a synthesized empty statement (";") that inherits
// original's source location, used as a no-op placeholder after stripping.
func emptyStatement(original *shimast.Node) *shimast.Statement {
  empty := shimast.NewNodeFactory(shimast.NodeFactoryHooks{}).NewEmptyStatement()
  empty.Flags |= shimast.NodeFlagsSynthesized
  if original != nil {
    empty.Loc = original.Loc
  }
  return empty
}

// shouldStripStatement reports whether node should be removed based on the
// current strip configuration. Only debugger and expression statements are
// candidates; all other statement kinds are retained.
func shouldStripStatement(node *shimast.Node, strip *stripRewriter) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindDebuggerStatement:
    return strip.stripDebugger
  case shimast.KindExpressionStatement:
    expr := node.AsExpressionStatement().Expression
    name, ok := callExpressionName(expr)
    return ok && strip.matchesCall(name)
  default:
    return false
  }
}

// matchesCall reports whether name matches any of the configured call patterns.
func (s *stripRewriter) matchesCall(name string) bool {
  for _, pattern := range s.calls {
    if pattern.matches(name) {
      return true
    }
  }
  return false
}

// parseCallPattern parses a dot-separated call pattern string such as
// "console.log" or "assert.*". A wildcard ("*") is only allowed as the
// final segment. Empty segments are rejected.
func parseCallPattern(text string) (callPattern, error) {
  parts := strings.Split(text, ".")
  for i, part := range parts {
    if part == "" {
      return callPattern{}, fmt.Errorf("invalid call pattern %q", text)
    }
    if part == "*" && i != len(parts)-1 {
      return callPattern{}, fmt.Errorf("wildcard is only supported at the end of call pattern %q", text)
    }
  }
  wildcard := parts[len(parts)-1] == "*"
  if wildcard {
    parts = parts[:len(parts)-1]
  }
  return callPattern{parts: parts, wildcard: wildcard}, nil
}

// matches reports whether a dotted call name (e.g. "console.log") matches
// the pattern. Wildcard patterns require at least one extra segment beyond
// the pattern prefix.
func (p callPattern) matches(name string) bool {
  parts := strings.Split(name, ".")
  if p.wildcard {
    if len(parts) <= len(p.parts) {
      return false
    }
    return equalStringSlices(parts[:len(p.parts)], p.parts)
  }
  return equalStringSlices(parts, p.parts)
}

// callExpressionName extracts the dotted callee name from a call expression
// node, e.g. "console.log" from `console.log(...)`. Returns ("", false) when
// expr is not a call expression or the callee is not a dotted identifier chain.
func callExpressionName(expr *shimast.Node) (string, bool) {
  if expr == nil || expr.Kind != shimast.KindCallExpression {
    return "", false
  }
  call := expr.AsCallExpression()
  return dottedName(call.Expression)
}

// dottedName recursively extracts a dot-joined identifier chain from an
// expression node. Returns ("", false) for any non-identifier, non-property-
// access node.
func dottedName(expr *shimast.Node) (string, bool) {
  if expr == nil {
    return "", false
  }
  switch expr.Kind {
  case shimast.KindIdentifier:
    return expr.Text(), true
  case shimast.KindPropertyAccessExpression:
    prop := expr.AsPropertyAccessExpression()
    left, ok := dottedName(prop.Expression)
    if !ok || prop.Name() == nil {
      return "", false
    }
    return left + "." + prop.Name().Text(), true
  default:
    return "", false
  }
}

// stringArrayConfig reads a string array from config[key]. Returns nil when the
// key is absent. Returns an error when the value is not an array of non-empty strings.
func stringArrayConfig(config map[string]any, key string) ([]string, error) {
  raw, ok := config[key]
  if !ok || raw == nil {
    return nil, nil
  }
  values, ok := raw.([]any)
  if !ok {
    return nil, fmt.Errorf("%q must be an array of strings", key)
  }
  out := make([]string, 0, len(values))
  for i, value := range values {
    text, ok := value.(string)
    if !ok || strings.TrimSpace(text) == "" {
      return nil, fmt.Errorf("%q[%d] must be a non-empty string", key, i)
    }
    out = append(out, text)
  }
  return out, nil
}

// equalStringSlices reports whether left and right contain the same strings in
// the same order.
func equalStringSlices(left, right []string) bool {
  if len(left) != len(right) {
    return false
  }
  for i := range left {
    if left[i] != right[i] {
      return false
    }
  }
  return true
}
