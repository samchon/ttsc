package mcp

import (
  "encoding/json"
  "fmt"
  "path/filepath"
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
        "description": "The compiler's own graph of the project's top-level declarations. For a symbol or file, returns its source plus its checker-resolved calls, type references, and heritage (in both directions) and its blast radius. Answer architecture and flow questions from it — the top-level structure is usually the whole answer; open a file only for logic inside a method or a variable-bound callable, which it does not model.",
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
        "description": "The TypeScript compiler's type errors for one file, with the exact tsc code and location.",
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

// maxExploreChars budgets the verbatim source in a response. Past it, further
// matched nodes render as a signature (header, edges, blast radius) without their
// body, so one call does not flood the agent's context with source it did not ask
// for, the adaptive-sizing idea codegraph uses.
const maxExploreChars = 7000

// maxEdgesPerDirection caps the incoming/outgoing edges listed per node so a
// central symbol does not dump hundreds of relationships into the response.
const maxEdgesPerDirection = 12

// explore returns the nodes matching a query and their checker-resolved
// relationships: each node's incoming/outgoing edges, blast radius, and verbatim
// line-numbered source, the last budgeted so a broad match collapses to
// signatures rather than dumping every body.
func (s *Server) explore(args json.RawMessage) (any, *rpcError) {
  var in struct {
    Query string `json:"query"`
  }
  if err := json.Unmarshal(args, &in); err != nil || strings.TrimSpace(in.Query) == "" {
    return nil, &rpcError{Code: codeInvalidParams, Message: "graph_explore requires a non-empty 'query'"}
  }
  if err := s.ensureLoaded(); err != nil {
    return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
  }
  matches := s.matchNodes(in.Query)
  if len(matches) == 0 {
    return textResult(fmt.Sprintf("No graph nodes match %q.", in.Query)), nil
  }
  var b strings.Builder
  collapsed := 0
  for _, node := range matches {
    withSource := b.Len() < maxExploreChars
    if !withSource {
      collapsed++
    }
    s.writeNodeRelations(&b, node, withSource)
  }
  if collapsed > 0 {
    fmt.Fprintf(&b, "(%d further node(s) shown as signatures to fit the response budget)\n", collapsed)
  }
  return textResult(strings.TrimRight(b.String(), "\n")), nil
}

// maxExploreNodes caps how many ranked nodes a query returns, so a broad
// keyword query surfaces the most relevant declarations without flooding context.
const maxExploreNodes = 12

// queryStopwords are dropped so the salient nouns of a natural-language question
// drive the match.
var queryStopwords = map[string]bool{
  "how": true, "does": true, "do": true, "the": true, "is": true, "are": true,
  "of": true, "to": true, "and": true, "or": true, "in": true, "on": true,
  "for": true, "with": true, "what": true, "where": true, "which": true,
  "this": true, "that": true, "it": true, "its": true, "work": true, "works": true,
  "use": true, "uses": true, "using": true, "from": true, "by": true, "an": true,
}

// queryTokens lowercases query and splits it into salient alphanumeric tokens,
// dropping stopwords and single characters, so a natural-language question
// reduces to the nouns that name symbols.
func queryTokens(query string) []string {
  fields := strings.FieldsFunc(strings.ToLower(query), func(r rune) bool {
    return !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9')
  })
  tokens := make([]string, 0, len(fields))
  for _, field := range fields {
    if len(field) < 2 || queryStopwords[field] {
      continue
    }
    tokens = append(tokens, field)
  }
  return tokens
}

// matchNodes ranks declarations by relevance to query, which may be a symbol name
// or the salient nouns of a natural-language question. A name is scored per query
// token (exact > prefix > substring) plus a small centrality bonus (edge degree),
// so "render update canvas element" surfaces the rendering symbols rather than
// forcing the agent to grep. The top maxExploreNodes are returned; a capped
// file-path match is the fallback when nothing scores on names.
func (s *Server) matchNodes(query string) []*graph.Node {
  whole := strings.ToLower(strings.TrimSpace(query))
  tokens := queryTokens(query)

  type scored struct {
    node  *graph.Node
    score int
  }
  ranked := make([]scored, 0)
  for _, node := range s.graph.Nodes {
    name := strings.ToLower(node.Name)
    score := 0
    if name == whole {
      score += 1000
    }
    for _, token := range tokens {
      switch {
      case name == token:
        score += 100
      case strings.HasPrefix(name, token):
        score += 40
      case strings.Contains(name, token):
        score += 20
      }
    }
    if score == 0 {
      continue
    }
    if degree := s.degree[node.ID]; degree > 0 {
      if degree > 20 {
        degree = 20
      }
      score += degree
    }
    ranked = append(ranked, scored{node, score})
  }
  if len(ranked) > 0 {
    sort.Slice(ranked, func(i, j int) bool {
      if ranked[i].score != ranked[j].score {
        return ranked[i].score > ranked[j].score
      }
      return ranked[i].node.ID < ranked[j].node.ID
    })
    out := make([]*graph.Node, 0, maxExploreNodes)
    for _, r := range ranked {
      if len(out) >= maxExploreNodes {
        break
      }
      out = append(out, r.node)
    }
    return out
  }

  byFile := make([]*graph.Node, 0)
  for _, node := range s.graph.Nodes {
    if strings.Contains(strings.ToLower(node.File), whole) {
      byFile = append(byFile, node)
    }
  }
  sort.Slice(byFile, func(i, j int) bool { return byFile[i].ID < byFile[j].ID })
  if len(byFile) > maxExploreNodes {
    byFile = byFile[:maxExploreNodes]
  }
  return byFile
}

// writeNodeRelations renders one node: a header with its source location, its
// outgoing/incoming checker-resolved edges, a blast-radius estimate, and (when
// withSource) the verbatim line-numbered declaration source. A signature-only
// render keeps the header and relationships but drops the body to fit the budget.
func (s *Server) writeNodeRelations(b *strings.Builder, node *graph.Node, withSource bool) {
  external := ""
  if node.External {
    external = " (external)"
  }
  source, line := s.nodeSource(node)
  fmt.Fprintf(b, "%s %s%s  %s:%d\n", node.Kind, node.Name, external, node.File, line)
  if !withSource {
    return // past the budget: a one-line signature, no edges or body
  }
  outgoing := make([]string, 0, maxEdgesPerDirection)
  incoming := make([]string, 0, maxEdgesPerDirection)
  outMore, inMore := 0, 0
  for _, edge := range s.graph.Edges {
    if edge.From == node.ID {
      if to := s.graph.Nodes[edge.To]; to != nil {
        if len(outgoing) < maxEdgesPerDirection {
          outgoing = append(outgoing, fmt.Sprintf("  -> %s %s (%s)", to.Kind, to.Name, edge.Kind))
        } else {
          outMore++
        }
      }
    }
    if edge.To == node.ID {
      if from := s.graph.Nodes[edge.From]; from != nil {
        if len(incoming) < maxEdgesPerDirection {
          incoming = append(incoming, fmt.Sprintf("  <- %s %s (%s)", from.Kind, from.Name, edge.Kind))
        } else {
          inMore++
        }
      }
    }
  }
  for _, edge := range outgoing {
    b.WriteString(edge)
    b.WriteByte('\n')
  }
  if outMore > 0 {
    fmt.Fprintf(b, "  -> (%d more)\n", outMore)
  }
  for _, edge := range incoming {
    b.WriteString(edge)
    b.WriteByte('\n')
  }
  if inMore > 0 {
    fmt.Fprintf(b, "  <- (%d more)\n", inMore)
  }
  if dependents := s.dependentCount(node); dependents > 0 {
    fmt.Fprintf(b, "  blast radius: %d transitive dependent(s)\n", dependents)
  }
  if withSource && source != "" {
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

// maxSourceLines caps the verbatim body shown per node, so one large declaration
// (a giant union type, a long class) cannot blow the whole response open.
const maxSourceLines = 32

// numberLines prefixes each line of source with its absolute line number so the
// agent can cite or edit by line without re-reading the file, truncating a long
// body to maxSourceLines.
func numberLines(source string, startLine int) string {
  lines := strings.Split(source, "\n")
  var b strings.Builder
  for i, line := range lines {
    if i >= maxSourceLines {
      fmt.Fprintf(&b, "  ... (%d more lines)\n", len(lines)-maxSourceLines)
      break
    }
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
  if err := s.ensureLoaded(); err != nil {
    return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
  }
  matches := s.resolveFile(in.File)
  switch len(matches) {
  case 0:
    return textResult(fmt.Sprintf("No project source file matches %q.", in.File)), nil
  case 1:
    // resolved to a single file, handled below
  default:
    var b strings.Builder
    fmt.Fprintf(&b, "%q matches %d files; pass a longer path fragment to disambiguate:\n", in.File, len(matches))
    for _, m := range matches {
      fmt.Fprintf(&b, "  %s\n", m)
    }
    return textResult(strings.TrimRight(b.String(), "\n")), nil
  }
  path := matches[0]
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

// resolveFile maps a tool's file argument to program source-file paths. An exact
// path match wins outright; otherwise it returns every source file whose path
// ends with the argument on a path-segment boundary (so "main.ts" matches
// "src/main.ts" but not "src/domain.ts"). Returning all matches lets the caller
// reject an ambiguous fragment instead of silently picking an arbitrary file.
func (s *Server) resolveFile(file string) []string {
  // tsgo normalizes FileName() to forward slashes, so normalize the argument too
  // — otherwise a Windows-style "src\main.ts" never matches "…/src/main.ts".
  file = filepath.ToSlash(file)
  for _, source := range s.prog.SourceFiles() {
    if source.FileName() == file {
      return []string{file}
    }
  }
  needle := "/" + file
  var matches []string
  for _, source := range s.prog.SourceFiles() {
    if strings.HasSuffix(source.FileName(), needle) {
      matches = append(matches, source.FileName())
    }
  }
  return matches
}
