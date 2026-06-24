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
        "description": graphExploreDescription,
        "inputSchema": map[string]any{
          "type": "object",
          "properties": map[string]any{
            "query": map[string]any{
              "type":        "string",
              "description": graphExploreQueryDescription,
            },
          },
          "required": []any{"query"},
        },
      },
      map[string]any{
        "name":        "graph_diagnostics",
        "description": graphDiagnosticsDescription,
        "inputSchema": map[string]any{
          "type": "object",
          "properties": map[string]any{
            "file": map[string]any{
              "type":        "string",
              "description": graphDiagnosticsFileDescription,
            },
          },
          "required": []any{"file"},
        },
      },
    },
  }
}

// clip bounds a client-supplied string before it is echoed into an error or
// "no match" message, so a pathological multi-megabyte name or query cannot turn
// a small request into an equally large response on a shared daemon.
func clip(s string, max int) string {
  if len(s) <= max {
    return s
  }
  return s[:max] + "…"
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
    return nil, &rpcError{Code: codeInvalidParams, Message: "unknown tool: " + clip(call.Name, 80)}
  }
}

// textResult wraps plain text in the MCP tools/call content envelope.
func textResult(text string) any {
  return map[string]any{
    "content": []any{map[string]any{"type": "text", "text": text}},
  }
}

// The verbatim-source budget scales with how broadly the agent asked. Past the
// budget, further matched nodes render as a signature (header, edges, blast
// radius) without their body, so one call does not flood the context with source
// it did not ask for.
//
// Why it scales with the query, not a flat cap: the agent's cost is dominated by
// the NUMBER of turns, not any one response, because every prior response is
// re-charged from the conversation cache on each later turn — K calls of size r
// cost on the order of r·K²/2. So a broad, multi-symbol query (the agent batching
// a whole flow) earns a large budget and gets the cluster back with bodies in one
// turn, which stops a thorough model from a long symbol-by-symbol BFS. A narrow,
// single-symbol query earns a small budget, so a shell-native agent that drills
// one name at a time is not charged for a cluster it did not request. Measured: a
// broad-batching model dropped from 9 calls to 4 once a broad query returned the
// whole cluster, while narrow drillers stay cheap per call.
const (
  exploreBudgetBase    = 3000
  exploreBudgetPerTerm = 1000
  exploreBudgetMax     = 6000
)

// exploreBudget returns the verbatim-source budget for a query with terms salient
// tokens: a base for the first symbol plus a per-extra-symbol increment, capped.
func exploreBudget(terms int) int {
  if terms < 1 {
    terms = 1
  }
  budget := exploreBudgetBase + exploreBudgetPerTerm*(terms-1)
  if budget > exploreBudgetMax {
    return exploreBudgetMax
  }
  return budget
}

// maxEdgesPerDirection caps the incoming/outgoing edges listed per node so a
// central symbol does not dump hundreds of relationships into the response.
const maxEdgesPerDirection = 8

// maxNodeDiagnostics caps the diagnostics listed on one node so a declaration
// with many errors does not flood the response; the count is still reported.
const maxNodeDiagnostics = 5

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
  s.refreshDiagnostics()
  matches := s.matchNodes(in.Query)
  if len(matches) == 0 {
    return textResult(fmt.Sprintf("No graph nodes match %q.", clip(in.Query, 200))), nil
  }
  budget := exploreBudget(len(queryTokens(in.Query)))
  var b strings.Builder
  b.WriteString(exploreHeader)
  collapsed := 0
  for _, node := range matches {
    withSource := b.Len() < budget
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

// exploreHeader prefixes every graph_explore response. It carries only the steer
// that is relevant at the moment the agent reads a result and decides its next
// move: the relationships are a compiler-built graph snapshot (a trust signal),
// and the right way to go deeper or refresh after edits is another broad graph
// query, not shelling out and re-reading paths already resolved here. It
// deliberately stops short of "never read source", because a budget-collapsed or
// external node is shown as a signature with no body, and opening that file is
// legitimate; what adds no precision is re-reading a path printed in full above.
const exploreHeader = "Compiler-resolved graph snapshot. Answer from this result; do not chase every edge. " +
  "Do not shell/grep/read returned source. Call graph_explore again only for no match, missing symbols, or source edits.\n\n"

// maxExploreNodes caps how many ranked nodes a query returns, so a broad
// keyword query surfaces the most relevant declarations without flooding context.
const maxExploreNodes = 8

// queryStopwords are dropped so the salient nouns of a natural-language question
// drive the match.
var queryStopwords = map[string]bool{
  "how": true, "does": true, "do": true, "the": true, "is": true, "are": true,
  "of": true, "to": true, "and": true, "or": true, "in": true, "on": true,
  "for": true, "with": true, "what": true, "where": true, "which": true,
  "this": true, "that": true, "it": true, "its": true, "work": true, "works": true,
  "use": true, "uses": true, "using": true, "from": true, "by": true, "an": true,
  "new": true, "only": true, "have": true, "few": true, "me": true, "give": true,
  "one": true, "joining": true, "need": true, "fast": true, "identify": true,
  "quick": true, "practical": true, "typescript": true, "project": true,
  "codebase": true, "orientation": true, "onboarding": true, "overview": true,
  "architecture": true, "subsystem": true, "subsystems": true, "best": true,
  "entry": true, "point": true, "points": true, "start": true, "reading": true,
  "representative": true, "execution": true, "flow": true, "shows": true,
  "piece": true, "pieces": true, "fit": true, "together": true, "minutes": true,
  "code": true, "map": true, "source": true, "read": true, "first": true,
  "dependency": true, "public": true, "api": true, "internal": true,
  "internals": true, "naming": true, "key": true, "file": true, "files": true,
  "class": true, "classes": true, "function": true, "functions": true,
  "path": true, "selected": true, "method": true, "methods": true,
  "request": true, "requests": true, "process": true, "main": true,
  "benchmark": true,
  "build": true, "builds": true, "built": true, "create": true, "creates": true,
  "created": true, "creation": true,
  "before": true, "after": true, "when": true, "invokes": true, "invoke": true,
  "invoked": true, "call": true, "calls": true, "called": true, "used": true,
  "toward": true, "into": true, "log": true, "logs": true, "message": true,
  "messages": true, "extension": true, "host": true,
  "apply": true, "applies": true, "applied": true, "option": true,
  "options": true, "query": true, "queries": true,
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

func queryWords(query string) map[string]bool {
  fields := strings.FieldsFunc(strings.ToLower(query), func(r rune) bool {
    return !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9')
  })
  words := make(map[string]bool, len(fields))
  for _, field := range fields {
    if len(field) >= 2 {
      words[field] = true
    }
  }
  return words
}

func containsWholeWord(words map[string]bool, value string) bool {
  return words[strings.ToLower(value)]
}

func containsMemberWord(words map[string]bool, member string) bool {
  member = strings.ToLower(member)
  if words[member] {
    return true
  }
  for word := range words {
    if len(word) >= 5 && strings.Contains(member, word) {
      return true
    }
    if len(member) >= 5 && strings.Contains(word, member) {
      return true
    }
  }
  return false
}

func naturalDottedScore(name string, words map[string]bool) int {
  dot := strings.LastIndexByte(name, '.')
  if dot <= 0 || dot == len(name)-1 {
    return 0
  }
  owner := name[:dot]
  if ownerDot := strings.LastIndexByte(owner, '.'); ownerDot >= 0 {
    owner = owner[ownerDot+1:]
  }
  member := name[dot+1:]
  if !containsWholeWord(words, owner) || !containsMemberWord(words, member) {
    return 0
  }
  return 650
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
  words := queryWords(query)
  if isBroadGraphQuery(whole, tokens) {
    return s.centralNodes()
  }

  type scored struct {
    node   *graph.Node
    score  int
    dotted bool
  }
  ranked := make([]scored, 0)
  for _, node := range s.graph.Nodes {
    name := strings.ToLower(node.Name)
    score := 0
    dotted := false
    if name == whole {
      score += 1000
    }
    if strings.Contains(name, ".") && strings.Contains(whole, name) {
      score += 900
      dotted = true
    } else if naturalScore := naturalDottedScore(name, words); naturalScore > 0 {
      score += naturalScore
      dotted = true
    } else if len(name) >= 8 && strings.Contains(whole, name) {
      score += 500
    }
    for _, token := range tokens {
      switch {
      case name == token:
        score += 100
      case strings.HasPrefix(name, token):
        score += 40
      case strings.Contains(name, token):
        switch {
        case len(token) >= 8:
          score += 80
        case len(token) >= 5:
          score += 24
        default:
          score += 12
        }
      }
    }
    if score == 0 {
      continue
    }
    if score >= 100 {
      if degree := s.degree[node.ID]; degree > 0 {
        if degree > 5 {
          degree = 5
        }
        score += degree
      }
    }
    ranked = append(ranked, scored{node, score, dotted})
  }
  if len(ranked) > 0 {
    sort.Slice(ranked, func(i, j int) bool {
      if ranked[i].score != ranked[j].score {
        return ranked[i].score > ranked[j].score
      }
      return ranked[i].node.ID < ranked[j].node.ID
    })
    dottedOwners := map[string]bool{}
    for _, r := range ranked {
      if !r.dotted {
        continue
      }
      if dot := strings.LastIndexByte(strings.ToLower(r.node.Name), '.'); dot > 0 {
        dottedOwners[strings.ToLower(r.node.Name[:dot])] = true
      }
    }
    out := make([]*graph.Node, 0, maxExploreNodes)
    for _, r := range ranked {
      if len(out) >= maxExploreNodes {
        break
      }
      if len(dottedOwners) > 0 &&
        strings.ToLower(string(r.node.Kind)) == "class" &&
        dottedOwners[strings.ToLower(r.node.Name)] {
        continue
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

// isBroadGraphQuery detects onboarding-style questions that intentionally carry
// no project-specific symbol. In that case returning central project nodes is
// more useful than matching arbitrary generic words such as "flow" or "entry".
func isBroadGraphQuery(query string, tokens []string) bool {
  for _, marker := range []string{"architecture", "architecture map", "orientation", "onboarding", "overview", "subsystem", "entry point", "execution flow", "call flow", "dependency"} {
    if strings.Contains(query, marker) {
      return len(tokens) <= 1
    }
  }
  return false
}

// centralNodes returns high-degree project nodes for broad codebase-orientation
// questions that do not name a symbol yet.
func (s *Server) centralNodes() []*graph.Node {
  type scored struct {
    node   *graph.Node
    degree int
  }
  ranked := make([]scored, 0)
  for _, node := range s.graph.Nodes {
    if node.External {
      continue
    }
    if isCentralNoise(node) {
      continue
    }
    degree := s.degree[node.ID]
    if degree == 0 {
      continue
    }
    ranked = append(ranked, scored{node: node, degree: degree})
  }
  sort.Slice(ranked, func(i, j int) bool {
    if ranked[i].degree != ranked[j].degree {
      return ranked[i].degree > ranked[j].degree
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

// isCentralNoise filters nodes that are often high-degree but poor architecture
// anchors for broad onboarding queries: error hierarchies and decorator helpers.
func isCentralNoise(node *graph.Node) bool {
  name := strings.ToLower(node.Name)
  file := "/" + strings.ToLower(filepath.ToSlash(node.File))
  return strings.HasSuffix(name, "error") ||
    strings.Contains(file, "/error/") ||
    strings.Contains(file, "/errors/") ||
    strings.Contains(file, "/decorator/") ||
    strings.Contains(file, "/decorators/")
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
  // The header cites declLine (the declaration keyword, past any doc comment), the
  // same line the edges to this node report, so one node is cited at one line
  // everywhere. The body below still renders from `line` (the source start), so a
  // leading doc comment is shown with its own true line numbers.
  fmt.Fprintf(b, "%s %s%s  %s:%d\n", node.Kind, node.Name, external, s.relFile(node.File), s.declLine(node))
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
          outgoing = append(outgoing, fmt.Sprintf("  -> (%s) %s %s  %s:%d", edge.Kind, to.Kind, to.Name, s.relFile(to.File), s.declLine(to)))
        } else {
          outMore++
        }
      }
    }
    if edge.To == node.ID {
      if from := s.graph.Nodes[edge.From]; from != nil {
        if len(incoming) < maxEdgesPerDirection {
          incoming = append(incoming, fmt.Sprintf("  <- (%s) %s %s  %s:%d", edge.Kind, from.Kind, from.Name, s.relFile(from.File), s.declLine(from)))
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
  // The live view fused onto the static structure: the diagnostics that land on
  // this declaration, and — the fix-safety angle — how much of its blast radius
  // is already broken, so the reach of an edit over current errors is visible
  // before the edit is made.
  if own := s.nodeDiagnostics(node); len(own) > 0 {
    sortDiagnostics(own)
    fmt.Fprintf(b, "  diagnostics here (%d):\n", len(own))
    for i, d := range own {
      if i >= maxNodeDiagnostics {
        fmt.Fprintf(b, "    ... (%d more)\n", len(own)-maxNodeDiagnostics)
        break
      }
      fmt.Fprintf(b, "    %s\n", formatDiagnostic(d))
    }
  }
  if deps := s.dependents(node); len(deps) > 0 {
    broken := 0
    for id := range deps {
      if len(s.diagsByNode[id]) > 0 {
        broken++
      }
    }
    if broken > 0 {
      fmt.Fprintf(b, "  blast radius: %d transitive dependent(s), %d with current errors\n", len(deps), broken)
    } else {
      fmt.Fprintf(b, "  blast radius: %d transitive dependent(s)\n", len(deps))
    }
  }
  if source != "" {
    b.WriteString(numberLines(source, line))
    s.writeValueCallExcerpts(b, node, source, line)
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

// relFile shortens an absolute workspace path to one relative to the project
// root (the server cwd), so a response does not repeat the long absolute prefix
// on every edge — pure token waste, since the agent runs from that root. A path
// outside the root (a bundled lib) or an empty cwd (the prebuilt/test path) is
// returned unchanged.
func (s *Server) relFile(file string) string {
  if s.cwd == "" {
    return file
  }
  // Trim a trailing separator off the root so a cwd like "/project/" still
  // matches "/project/src/...". Return the forward-slash-normalized form even for
  // a path outside the root (a bundled lib), so every path in a response is
  // consistently forward-slash rather than mixing in OS-native backslashes.
  root := strings.TrimRight(strings.ReplaceAll(s.cwd, "\\", "/"), "/")
  f := strings.ReplaceAll(file, "\\", "/")
  if strings.HasPrefix(f, root+"/") {
    return f[len(root)+1:]
  }
  return f
}

// firstCodeOffset returns the index in src of the first non-trivia byte — past
// leading whitespace and // line or /* */ block comments — so a signature begins
// at the declaration keyword rather than a leading doc comment or, worse, a
// .d.ts license banner that node.Pos includes as leading trivia.
func firstCodeOffset(src string) int {
  i := 0
  for i < len(src) {
    switch {
    case isSpace(src[i]):
      i++
    case src[i] == '/' && i+1 < len(src) && src[i+1] == '/':
      if j := strings.IndexByte(src[i:], '\n'); j >= 0 {
        i += j + 1
      } else {
        return len(src)
      }
    case src[i] == '/' && i+1 < len(src) && src[i+1] == '*':
      if j := strings.Index(src[i+2:], "*/"); j >= 0 {
        i += 2 + j + 2
      } else {
        return len(src)
      }
    default:
      return i
    }
  }
  return i
}

// declLine returns node's 1-based declaration line, skipping the leading doc
// comment that node.Pos carries as trivia so the line points at the declaration
// itself. Carrying this on every edge is what lets a shell-native agent cite a
// call target without re-reading the file to count lines — the dominant residual
// cost the bare-name edge left on the table (a full signature, by contrast, only
// bloated the response without cutting the body fetches a thorough model makes).
func (s *Server) declLine(node *graph.Node) int {
  src, line := s.nodeSource(node)
  if src == "" {
    return line
  }
  return line + strings.Count(src[:firstCodeOffset(src)], "\n")
}

// maxSourceLines caps the verbatim body shown per node, so one large declaration
// (a giant union type, a long class) cannot blow the whole response open.
const maxSourceLines = 16

// maxCallExcerpts caps the late-body call snippets printed after a truncated
// declaration. These snippets are tied to checker-resolved value-call edges, so
// they preserve code-flow context without dumping the whole body.
const maxCallExcerpts = 6

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

func (s *Server) writeValueCallExcerpts(b *strings.Builder, node *graph.Node, source string, startLine int) {
  lines := strings.Split(source, "\n")
  if len(lines) <= maxSourceLines {
    return
  }
  shown := 0
  seen := map[int]bool{}
  for _, edge := range s.graph.Edges {
    if edge.From != node.ID || edge.Kind != graph.EdgeValueCall {
      continue
    }
    to := s.graph.Nodes[edge.To]
    if to == nil {
      continue
    }
    idx := findLateCallLine(lines, memberName(to.Name))
    if idx < 0 || seen[idx] {
      continue
    }
    if shown == 0 {
      b.WriteString("  call excerpts after truncated body:\n")
    }
    seen[idx] = true
    fmt.Fprintf(b, "  %d\t%s\n", startLine+idx, lines[idx])
    shown++
    if shown >= maxCallExcerpts {
      b.WriteString("  ... (more value-call excerpts omitted)\n")
      return
    }
  }
}

func memberName(name string) string {
  if dot := strings.LastIndexByte(name, '.'); dot >= 0 {
    return name[dot+1:]
  }
  return name
}

func findLateCallLine(lines []string, member string) int {
  if member == "" {
    return -1
  }
  for i := maxSourceLines; i < len(lines); i++ {
    if containsCallLike(lines[i], member) {
      return i
    }
  }
  return -1
}

func containsCallLike(line string, member string) bool {
  start := 0
  for {
    idx := strings.Index(line[start:], member)
    if idx < 0 {
      return false
    }
    idx += start
    end := idx + len(member)
    if isIdentifierBoundary(line, idx-1) {
      rest := strings.TrimLeft(line[end:], " \t")
      if strings.HasPrefix(rest, "(") || strings.HasPrefix(rest, "<") {
        return true
      }
    }
    start = end
  }
}

func isIdentifierBoundary(line string, idx int) bool {
  if idx < 0 {
    return true
  }
  c := line[idx]
  return !(c >= 'a' && c <= 'z') &&
    !(c >= 'A' && c <= 'Z') &&
    !(c >= '0' && c <= '9') &&
    c != '_' &&
    c != '$'
}

// dependents returns the set of distinct node ids that transitively depend on
// node (reach it through an edge): the blast radius of an edit, walked over the
// reverse adjacency. The caller intersects it with the diagnostics index to show
// how much of the reach is already broken.
func (s *Server) dependents(node *graph.Node) map[string]bool {
  seen := map[string]bool{}
  queue := []string{node.ID}
  for len(queue) > 0 {
    current := queue[0]
    queue = queue[1:]
    for _, from := range s.reverseAdj[current] {
      if !seen[from] {
        seen[from] = true
        queue = append(queue, from)
      }
    }
  }
  return seen
}

// nodeDiagnostics returns the diagnostics attributed to a node plus those on any
// node nested within its source span. A class collects its methods' findings, so
// exploring the class shows that its members are broken — the fix-safety signal
// would otherwise sit only on the member nodes, which the agent has not named.
func (s *Server) nodeDiagnostics(node *graph.Node) []fusedDiagnostic {
  out := append([]fusedDiagnostic(nil), s.diagsByNode[node.ID]...)
  for _, other := range s.graph.Nodes {
    if other.ID == node.ID || other.File != node.File {
      continue
    }
    if other.Pos >= node.Pos && other.End <= node.End {
      out = append(out, s.diagsByNode[other.ID]...)
    }
  }
  return out
}

// formatDiagnostic renders one diagnostic for a node listing. A compiler
// diagnostic shows its "TSxxxx" code; a plugin/lint finding drops the code (its
// hashed value is meaningless and its rule is already in the message) and shows
// just the location and text. The origin is carried on the diagnostic, not
// inferred from the code, since tsc codes are not bounded below the plugin band.
func formatDiagnostic(d fusedDiagnostic) string {
  if d.fromTsc {
    return fmt.Sprintf("TS%d line %d: %s", d.Code, d.Line, d.Message)
  }
  return fmt.Sprintf("line %d: %s", d.Line, d.Message)
}

// diagnostics returns a file's diagnostics as text. It reads the fused set, so
// when a plugin-aware host has injected @ttsc/lint and transform-plugin findings
// they appear here alongside the tsc errors, in the same code and location tsc
// reports.
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
  s.refreshDiagnostics()
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
  found := make([]fusedDiagnostic, 0)
  for _, d := range s.diags {
    if d.File == path {
      found = append(found, d)
    }
  }
  if len(found) == 0 {
    return textResult(fmt.Sprintf("No diagnostics for %s.", path)), nil
  }
  sortDiagnostics(found)
  // Print the program-matched canonical path, not each diagnostic's own File: the
  // findings were selected by d.File == path, so this is identical for valid data,
  // but it keeps the printed path inside the workspace even if an injected
  // diagnostic ever carried a stray File, and it stays consistent with the
  // relative paths graph_explore prints.
  relPath := s.relFile(path)
  var b strings.Builder
  for _, d := range found {
    if d.fromTsc {
      fmt.Fprintf(&b, "%s:%d:%d TS%d %s\n", relPath, d.Line, d.Column, d.Code, d.Message)
    } else {
      fmt.Fprintf(&b, "%s:%d:%d %s\n", relPath, d.Line, d.Column, d.Message)
    }
  }
  return textResult(strings.TrimRight(b.String(), "\n")), nil
}

// sortDiagnostics orders diagnostics by source location so a file's findings
// read top-to-bottom (the fused set otherwise lists the compiler's pass before
// the injected plugin findings, regardless of line).
func sortDiagnostics(diags []fusedDiagnostic) {
  sort.Slice(diags, func(i, j int) bool {
    if diags[i].Line != diags[j].Line {
      return diags[i].Line < diags[j].Line
    }
    if diags[i].Column != diags[j].Column {
      return diags[i].Column < diags[j].Column
    }
    return diags[i].Code < diags[j].Code
  })
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
