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
//
// TypeScript-Go's StatementList and ForEachChild APIs supply the traversal.
// Filtering only changes the current parent's list or embedded body; recursion
// belongs to ForEachChild. List filtering does not visit retained subtrees,
// leaving traversal ownership with one recursive path.
//
// Configuration and parsed patterns are shared for this program invocation.
// Filtering compacts each statement list in its own backing array and clears
// removed tail references, avoiding a replacement allocation per block. The
// remaining dominant work is visiting AST nodes and matching configured calls.
//
// Only configured expression statements and debugger statements are removed.
// Matching recognizes dotted identifiers rather than evaluating expressions;
// argument effects are intentionally deleted with a matched whole statement.
// Embedded bodies become source-located empty statements so required body
// slots remain present, while retained AST nodes keep their identity.
func (plugin) ApplyProgram(prog *driver.Program, ctx driver.PluginContext) error {
  config, err := loadStripConfigMapWithReporters(ctx.Entry.Config, ctx.Cwd, ctx.Tsconfig, ctx.ReportHostInput, ctx.ReportHostInputHash, ctx.ReportHostInputRealpath, ctx.ReportObservationIncomplete)
  if err != nil {
    return err
  }
  rewriter, err := parseStrip(config)
  if err != nil {
    return err
  }
  // The rewrite reads the statements in front of it and the configured
  // patterns, never the checker and never another file, so what a file's
  // output depends on is that file's own text plus strip.config.*, which was
  // reported above as a host input (samchon/ttsc#1263).
  ctx.ReportDependenciesComplete()
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

// apply filters the file through one recursive traversal. Each parent removes
// matching list entries or replaces embedded bodies before visiting its children.
func (s *stripRewriter) apply(file *shimast.SourceFile) {
  if s == nil || file == nil || (len(s.calls) == 0 && !s.stripDebugger) {
    return
  }
  filterChildStatements(file.AsNode(), s)
}

// filterStatements removes stripped statements from list in-place, preserving
// order. It leaves recursion to filterChildStatements so a retained subtree is
// not processed once through its statement list and again through ForEachChild.
func filterStatements(list *shimast.NodeList, strip *stripRewriter) {
  if list == nil || len(list.Nodes) == 0 {
    return
  }
  out := list.Nodes[:0]
  for _, stmt := range list.Nodes {
    if shouldStripStatement(stmt, strip) {
      continue
    }
    out = append(out, stmt)
  }
  clear(list.Nodes[len(out):])
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

// filterEmbeddedStatement filters a single embedded statement without recursion.
// Returns an empty synthesized statement when stmt is to be stripped, preserving
// the original source location for downstream source-map accuracy. The parent's
// ForEachChild traversal owns recursion into retained or replacement bodies.
func filterEmbeddedStatement(stmt *shimast.Statement, strip *stripRewriter) *shimast.Statement {
  if stmt == nil {
    return nil
  }
  if shouldStripStatement(stmt, strip) {
    return emptyStatement(stmt)
  }
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

// matchesCall reports whether name matches any configured call pattern.
// All patterns share one segmentation of this call's name.
func (s *stripRewriter) matchesCall(name string) bool {
  if len(s.calls) == 0 {
    return false
  }
  parts := strings.Split(name, ".")
  for _, pattern := range s.calls {
    if pattern.matchesParts(parts) {
      return true
    }
  }
  return false
}

// parseCallPattern parses a dot-separated call pattern string such as
// "console.log" or "assert.*". A wildcard ("*") requires a dotted prefix
// and must be the whole final segment; embedded stars and empty segments are
// rejected.
func parseCallPattern(text string) (callPattern, error) {
  parts := strings.Split(text, ".")
  for i, part := range parts {
    if part == "" {
      return callPattern{}, fmt.Errorf("invalid call pattern %q", text)
    }
    if strings.Contains(part, "*") && (part != "*" || i != len(parts)-1) {
      return callPattern{}, fmt.Errorf("wildcard is only supported as the final segment of call pattern %q", text)
    }
  }
  wildcard := parts[len(parts)-1] == "*"
  if wildcard {
    if len(parts) == 1 {
      return callPattern{}, fmt.Errorf("wildcard requires a dotted call prefix in pattern %q", text)
    }
    parts = parts[:len(parts)-1]
  }
  return callPattern{parts: parts, wildcard: wildcard}, nil
}

// matches reports whether a dotted call name (e.g. "console.log") matches
// the pattern. Wildcard patterns require at least one extra segment beyond
// the pattern prefix.
func (p callPattern) matches(name string) bool {
  return p.matchesParts(strings.Split(name, "."))
}

// matchesParts compares already segmented names so a multi-pattern search
// does not allocate the same segments for every candidate pattern.
func (p callPattern) matchesParts(parts []string) bool {
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

// dottedName extracts a dot-joined identifier chain from an
// expression node. Returns ("", false) for any non-identifier, non-property-
// access node. Segments are collected from right to left, then emitted once
// in source order without recursively copying a growing dotted prefix.
func dottedName(expr *shimast.Node) (string, bool) {
  var suffix []string
  for expr != nil && expr.Kind == shimast.KindPropertyAccessExpression {
    prop := expr.AsPropertyAccessExpression()
    if prop.Name() == nil {
      return "", false
    }
    suffix = append(suffix, prop.Name().Text())
    expr = prop.Expression
  }
  if expr == nil || expr.Kind != shimast.KindIdentifier {
    return "", false
  }
  if len(suffix) == 0 {
    return expr.Text(), true
  }
  var name strings.Builder
  name.WriteString(expr.Text())
  for i := len(suffix) - 1; i >= 0; i-- {
    name.WriteByte('.')
    name.WriteString(suffix[i])
  }
  return name.String(), true
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
