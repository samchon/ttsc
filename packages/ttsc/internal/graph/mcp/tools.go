package mcp

import (
  "encoding/json"
  "fmt"
  "sort"
  "strings"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// toolsListResult advertises the tool surface. Following codegraph's hard-won
// lesson, graph_explore is the fat, agent-facing default that answers a
// structural question in one round-trip; graph_diagnostics is the focused
// "what's wrong with this file" tool.
func toolsListResult() any {
  return map[string]any{
    "tools": []any{
      map[string]any{
        "name":        "graph_explore",
        "description": "Explore the checker-resolved code graph around a symbol or file: returns the matching nodes and their relationships (what they extend/implement and what derives from them). Start here for structural questions before reading files.",
        "inputSchema": map[string]any{
          "type": "object",
          "properties": map[string]any{
            "query": map[string]any{
              "type":        "string",
              "description": "A symbol name (e.g. \"MyClass\") or a file path fragment (e.g. \"src/service\").",
            },
          },
          "required": []any{"query"},
        },
      },
      map[string]any{
        "name":        "graph_diagnostics",
        "description": "Return the tsc semantic diagnostics for one file, in the same code and location tsgo reports.",
        "inputSchema": map[string]any{
          "type": "object",
          "properties": map[string]any{
            "file": map[string]any{
              "type":        "string",
              "description": "An absolute path or a trailing fragment of a project source file (e.g. \"src/main.ts\").",
            },
          },
          "required": []any{"file"},
        },
      },
    },
  }
}

// callTool routes a tools/call request to the named tool.
func (s *Server) callTool(params json.RawMessage) (any, *rpcError) {
  var call struct {
    Name      string          `json:"name"`
    Arguments json.RawMessage `json:"arguments"`
  }
  if err := json.Unmarshal(params, &call); err != nil {
    return nil, &rpcError{Code: codeInvalidParams, Message: "invalid tools/call params"}
  }
  switch call.Name {
  case "graph_explore":
    return s.explore(call.Arguments)
  case "graph_diagnostics":
    return s.diagnostics(call.Arguments)
  default:
    return nil, &rpcError{Code: codeInvalidParams, Message: "unknown tool: " + call.Name}
  }
}

// textResult wraps plain text in the MCP tools/call content envelope.
func textResult(text string) any {
  return map[string]any{
    "content": []any{map[string]any{"type": "text", "text": text}},
  }
}

// explore returns the nodes matching a query and their checker-resolved
// relationships. v1 renders the relationship map; verbatim source and blast
// radius are layered on later.
func (s *Server) explore(args json.RawMessage) (any, *rpcError) {
  var in struct {
    Query string `json:"query"`
  }
  if err := json.Unmarshal(args, &in); err != nil || strings.TrimSpace(in.Query) == "" {
    return nil, &rpcError{Code: codeInvalidParams, Message: "graph_explore requires a non-empty 'query'"}
  }
  matches := s.matchNodes(in.Query)
  if len(matches) == 0 {
    return textResult(fmt.Sprintf("No graph nodes match %q.", in.Query)), nil
  }
  var b strings.Builder
  for _, node := range matches {
    s.writeNodeRelations(&b, node)
  }
  return textResult(strings.TrimRight(b.String(), "\n")), nil
}

// matchNodes returns the nodes whose name equals the query or whose file path
// contains it, sorted by id for a stable response.
func (s *Server) matchNodes(query string) []*graph.Node {
  matches := make([]*graph.Node, 0)
  for _, node := range s.graph.Nodes {
    if node.Name == query || strings.Contains(node.File, query) {
      matches = append(matches, node)
    }
  }
  sort.Slice(matches, func(i, j int) bool { return matches[i].ID < matches[j].ID })
  return matches
}

// writeNodeRelations renders one node: a header with its source location, its
// outgoing/incoming checker-resolved edges, a blast-radius estimate, and the
// verbatim line-numbered declaration source.
func (s *Server) writeNodeRelations(b *strings.Builder, node *graph.Node) {
  external := ""
  if node.External {
    external = " (external)"
  }
  source, line := s.nodeSource(node)
  fmt.Fprintf(b, "%s %s%s  %s:%d\n", node.Kind, node.Name, external, node.File, line)
  for _, edge := range s.graph.Edges {
    if edge.From == node.ID {
      if to := s.graph.Nodes[edge.To]; to != nil {
        fmt.Fprintf(b, "  -> %s %s (%s)\n", to.Kind, to.Name, edge.Kind)
      }
    }
    if edge.To == node.ID {
      if from := s.graph.Nodes[edge.From]; from != nil {
        fmt.Fprintf(b, "  <- %s %s (%s)\n", from.Kind, from.Name, edge.Kind)
      }
    }
  }
  if dependents := s.dependentCount(node); dependents > 0 {
    fmt.Fprintf(b, "  blast radius: %d transitive dependent(s)\n", dependents)
  }
  if source != "" {
    b.WriteString(numberLines(source, line))
  }
  b.WriteString("\n")
}

// nodeSource returns the verbatim declaration text of node and its 1-based start
// line, or ("", 0) when the source file is not in the program or the span is out
// of range. Leading whitespace before the declaration is skipped so the slice
// starts at the declaration keyword (or its leading doc comment).
func (s *Server) nodeSource(node *graph.Node) (string, int) {
  file := s.prog.SourceFile(node.File)
  if file == nil {
    return "", 0
  }
  text := file.Text()
  if node.Pos < 0 || node.End > len(text) || node.Pos >= node.End {
    return "", 0
  }
  start := node.Pos
  for start < node.End && isSpace(text[start]) {
    start++
  }
  return text[start:node.End], 1 + strings.Count(text[:start], "\n")
}

func isSpace(c byte) bool {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r'
}

// numberLines prefixes each line of source with its absolute line number so the
// agent can cite or edit by line without re-reading the file.
func numberLines(source string, startLine int) string {
  var b strings.Builder
  for i, line := range strings.Split(source, "\n") {
    fmt.Fprintf(&b, "  %d\t%s\n", startLine+i, line)
  }
  return b.String()
}

// dependentCount returns the number of distinct nodes that transitively depend
// on node (reach it through an edge): a blast-radius estimate for an edit, walked
// over the reverse adjacency.
func (s *Server) dependentCount(node *graph.Node) int {
  seen := map[string]bool{}
  queue := []string{node.ID}
  for len(queue) > 0 {
    current := queue[0]
    queue = queue[1:]
    for _, edge := range s.graph.Edges {
      if edge.To == current && !seen[edge.From] {
        seen[edge.From] = true
        queue = append(queue, edge.From)
      }
    }
  }
  return len(seen)
}

// diagnostics returns a file's tsc semantic diagnostics as text.
func (s *Server) diagnostics(args json.RawMessage) (any, *rpcError) {
  var in struct {
    File string `json:"file"`
  }
  if err := json.Unmarshal(args, &in); err != nil || strings.TrimSpace(in.File) == "" {
    return nil, &rpcError{Code: codeInvalidParams, Message: "graph_diagnostics requires a non-empty 'file'"}
  }
  path, ok := s.resolveFile(in.File)
  if !ok {
    return textResult(fmt.Sprintf("No project source file matches %q.", in.File)), nil
  }
  found := graph.FileDiagnostics(s.prog, path)
  if len(found) == 0 {
    return textResult(fmt.Sprintf("No diagnostics for %s.", path)), nil
  }
  var b strings.Builder
  for _, d := range found {
    fmt.Fprintf(&b, "%s:%d:%d TS%d %s\n", d.File, d.Line, d.Column, d.Code, d.Message)
  }
  return textResult(strings.TrimRight(b.String(), "\n")), nil
}

// resolveFile maps a tool's file argument to a program source-file path: an exact
// match if present, otherwise the unique source file whose path ends with the
// argument. Returns ("", false) when nothing matches.
func (s *Server) resolveFile(file string) (string, bool) {
  for _, source := range s.prog.SourceFiles() {
    if source.FileName() == file {
      return file, true
    }
  }
  for _, source := range s.prog.SourceFiles() {
    if strings.HasSuffix(source.FileName(), file) {
      return source.FileName(), true
    }
  }
  return "", false
}
