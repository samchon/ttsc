package mcp

import (
  "encoding/json"
  "fmt"
  "hash/fnv"
  "os"
  "path/filepath"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// queryFilesEnabled reports whether the query_files tool is advertised and
// callable. On by default; set TTSC_GRAPH_NO_FILES to drop it, so a benchmark can
// measure the query_nodes-only surface (query_files goes unused for relationship
// and call-flow questions, where the fuzzy query_nodes is the workhorse).
func queryFilesEnabled() bool {
  return os.Getenv("TTSC_GRAPH_NO_FILES") == ""
}

// toolsListResult advertises the tool surface: query_exports orients the agent
// around the public surface, query_nodes answers relationship questions,
// query_files outlines files, and query_diagnostics is the focused "what is
// broken" tool.
func toolsListResult() any {
  tools := []any{
    map[string]any{
      "name":        "query_exports",
      "description": queryExportsDescription,
      "inputSchema": map[string]any{
        "type": "object",
        "properties": map[string]any{
          "query": map[string]any{
            "type":        "string",
            "description": queryExportsQueryDescription,
          },
          "limit": map[string]any{
            "type":        "integer",
            "minimum":     0,
            "maximum":     maxExportLimit,
            "default":     defaultExportLimit,
            "description": queryExportsLimitDescription,
          },
          "offset": map[string]any{
            "type":        "integer",
            "minimum":     0,
            "default":     0,
            "description": queryExportsOffsetDescription,
          },
        },
        "required": []any{},
      },
    },
    map[string]any{
      "name":        "query_nodes",
      "description": queryNodesDescription,
      "inputSchema": map[string]any{
        "type": "object",
        "properties": map[string]any{
          "query": map[string]any{
            "type":        "string",
            "description": queryNodesQueryDescription,
          },
          "mode": map[string]any{
            "type":        "string",
            "enum":        []any{"auto", "search", "flow"},
            "default":     "auto",
            "description": queryNodesModeDescription,
          },
        },
        "required": []any{"query"},
      },
    },
    map[string]any{
      "name":        "expand_nodes",
      "description": expandNodesDescription,
      "inputSchema": map[string]any{
        "type": "object",
        "properties": map[string]any{
          "ids": map[string]any{
            "type":        "array",
            "items":       map[string]any{"type": "string"},
            "description": expandNodesIDsDescription,
          },
          "mode": map[string]any{
            "type":        "string",
            "enum":        []any{"source", "flow"},
            "default":     "source",
            "description": expandNodesModeDescription,
          },
        },
        "required": []any{"ids"},
      },
    },
  }
  if queryFilesEnabled() {
    tools = append(tools, map[string]any{
      "name":        "query_files",
      "description": queryFilesDescription,
      "inputSchema": map[string]any{
        "type": "object",
        "properties": map[string]any{
          "locations": map[string]any{
            "type":        "array",
            "items":       map[string]any{"type": "string"},
            "description": queryFilesLocationsDescription,
          },
        },
        "required": []any{"locations"},
      },
    })
  }
  tools = append(tools, map[string]any{
    "name":        "query_diagnostics",
    "description": queryDiagnosticsDescription,
    "inputSchema": map[string]any{
      "type": "object",
      "properties": map[string]any{
        "files": map[string]any{
          "type":        "array",
          "items":       map[string]any{"type": "string"},
          "description": queryDiagnosticsFilesDescription,
        },
        "severity": map[string]any{
          "type":        "string",
          "enum":        []any{"error", "warning", "all"},
          "default":     "error",
          "description": queryDiagnosticsSeverityDescription,
        },
      },
      "required": []any{},
    },
  })
  return map[string]any{"tools": tools}
}

// clip bounds a client-supplied string before it is echoed into an error or
// "no match" message, so a pathological multi-megabyte name or query cannot turn
// a small request into an equally large response on a shared daemon.
func clip(s string, max int) string {
  if len(s) <= max {
    return s
  }
  return s[:max] + "..."
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
  case "query_exports":
    return s.queryExports(call.Arguments)
  case "query_nodes":
    return s.queryNodes(call.Arguments)
  case "expand_nodes":
    return s.expandNodes(call.Arguments)
  case "query_files":
    if !queryFilesEnabled() {
      return nil, &rpcError{Code: codeInvalidParams, Message: "unknown tool: query_files"}
    }
    return s.queryFiles(call.Arguments)
  case "query_diagnostics":
    return s.queryDiagnostics(call.Arguments)
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
// re-charged from the conversation cache on each later turn. K calls of size r
// cost on the order of r·K²/2. So a broad, multi-symbol query (the agent batching
// a whole flow) earns a large budget and gets the cluster back with bodies in one
// turn, which stops a thorough model from a long symbol-by-symbol BFS. A narrow,
// single-symbol query earns a small budget, so a shell-native agent that drills
// one name at a time is not charged for a cluster it did not request. Measured: a
// broad-batching model dropped from 9 calls to 4 once a broad query returned the
// whole cluster, while narrow drillers stay cheap per call.
const (
  queryBudgetBase    = 6000
  queryBudgetPerTerm = 3000
  queryBudgetMax     = 16000
)

// queryBudget returns the verbatim-source budget for a query with terms salient
// tokens: a base for the first symbol plus a per-extra-symbol increment, capped.
func queryBudget(terms int) int {
  if terms < 1 {
    terms = 1
  }
  budget := queryBudgetBase + queryBudgetPerTerm*(terms-1)
  if budget > queryBudgetMax {
    return queryBudgetMax
  }
  return budget
}

// maxEdgesPerDirection caps the incoming/outgoing edges listed per node so a
// central symbol does not dump hundreds of relationships into the response.
const maxEdgesPerDirection = 12

// maxNodeDiagnostics caps the diagnostics listed on one node so a declaration
// with many errors does not flood the response; the count is still reported.
const maxNodeDiagnostics = 5

const (
  defaultExportLimit = 100
  maxExportLimit     = 10000
)

type exportEntry struct {
  name        string
  exportNames []string
  kind        graph.NodeKind
  file        string
  line        int
  handle      string
  sources     []string
  valueCalls  int
  valueUses   int
  typeRefs    int
  dependents  int
}

type exportInfo struct {
  names   []string
  sources []string
}

// queryExports is the project-orientation tool: it lists compiler-known exported
// symbols with enough coordinates for the agent to choose exact graph queries.
// It deliberately omits source bodies and git-ignored generated files.
func (s *Server) queryExports(args json.RawMessage) (any, *rpcError) {
  var in struct {
    Query  string `json:"query"`
    Limit  *int   `json:"limit"`
    Offset int    `json:"offset"`
  }
  if len(args) != 0 {
    if err := json.Unmarshal(args, &in); err != nil {
      return nil, &rpcError{Code: codeInvalidParams, Message: "query_exports: invalid arguments"}
    }
  }
  limit := defaultExportLimit
  if in.Limit != nil {
    limit = *in.Limit
  }
  if limit < 0 || limit > maxExportLimit {
    return nil, &rpcError{Code: codeInvalidParams, Message: fmt.Sprintf("query_exports limit must be between 0 and %d", maxExportLimit)}
  }
  if in.Offset < 0 {
    return nil, &rpcError{Code: codeInvalidParams, Message: "query_exports offset must be >= 0"}
  }
  if err := s.ensureLoaded(); err != nil {
    return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
  }
  s.refreshIfStale()
  entries := s.exportEntries(in.Query)
  return textResult(s.renderExportEntries(entries, in.Query, in.Offset, limit)), nil
}

// queryNodes answers a relationship question: one broad fuzzy query returns the
// matched declarations with their edges, blast radius, and budgeted source. The
// fuzzy match is the batching mechanism, so a broad multi-noun query returns a
// whole cluster in one call.
func (s *Server) queryNodes(args json.RawMessage) (any, *rpcError) {
  var in struct {
    Query string `json:"query"`
    Mode  string `json:"mode"`
  }
  if err := json.Unmarshal(args, &in); err != nil || strings.TrimSpace(in.Query) == "" {
    return nil, &rpcError{Code: codeInvalidParams, Message: "query_nodes requires a non-empty 'query'"}
  }
  mode := strings.TrimSpace(in.Mode)
  if mode == "" {
    mode = "auto"
  }
  if mode != "auto" && mode != "search" && mode != "flow" {
    return nil, &rpcError{Code: codeInvalidParams, Message: "query_nodes mode must be auto, search, or flow"}
  }
  if err := s.ensureLoaded(); err != nil {
    return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
  }
  s.refreshIfStale()
  s.refreshDiagnostics()
  matches := s.matchNodes(in.Query)
  if len(matches) == 0 {
    return textResult(fmt.Sprintf("No graph nodes match %q.", clip(in.Query, 200))), nil
  }
  // Expand the downstream call path only when the user actually asked for a flow.
  // Exact public-surface questions need the next few compiler-resolved calls
  // inline; otherwise thorough agents re-query or read the target files just to
  // confirm the path. Plain symbol lookups can still opt out by setting
  // TTSC_GRAPH_CALLPATH=0.
  nodes := matches
  callPath := mode == "flow" || (mode == "auto" && s.shouldAutoFlow(in.Query, matches))
  if callPath {
    nodes = s.withCallPath(matches, maxPathNodes, in.Query)
    nodes = s.filterFlowNodes(nodes, in.Query)
    return textResult(s.renderFlowNodes(nodes, in.Query, "")), nil
  }
  return textResult(s.renderNodes(nodes, queryBudget(len(queryTokens(in.Query))), "")), nil
}

func (s *Server) shouldAutoFlow(query string, matches []*graph.Node) bool {
  if os.Getenv("TTSC_GRAPH_CALLPATH") == "0" || len(matches) == 0 {
    return false
  }
  if isSingleSymbolQuery(query) {
    return false
  }
  if hasDottedIdentifierWithContext(query) {
    return true
  }
  return s.matchesShareCallPath(matches)
}

func isSingleSymbolQuery(query string) bool {
  q := strings.TrimSpace(query)
  q = strings.Trim(q, "`")
  q = strings.TrimSuffix(q, "()")
  if q == "" {
    return false
  }
  for _, r := range q {
    if (r >= 'a' && r <= 'z') ||
      (r >= 'A' && r <= 'Z') ||
      (r >= '0' && r <= '9') ||
      r == '_' || r == '$' || r == '.' {
      continue
    }
    return false
  }
  return true
}

func hasDottedIdentifierWithContext(query string) bool {
  if !strings.ContainsAny(query, " \t\r\n") {
    return false
  }
  fields := strings.FieldsFunc(query, func(r rune) bool {
    return !((r >= 'a' && r <= 'z') ||
      (r >= 'A' && r <= 'Z') ||
      (r >= '0' && r <= '9') ||
      r == '_' || r == '$' || r == '.')
  })
  for _, field := range fields {
    if dot := strings.IndexByte(field, '.'); dot > 0 && dot < len(field)-1 {
      return true
    }
  }
  return false
}

func (s *Server) matchesShareCallPath(matches []*graph.Node) bool {
  target := make(map[string]bool, len(matches))
  for _, node := range matches {
    if node != nil {
      target[node.ID] = true
    }
  }
  for _, node := range matches {
    if node == nil {
      continue
    }
    seen := map[string]bool{node.ID: true}
    queue := []string{node.ID}
    for depth := 0; depth < 4 && len(queue) > 0; depth++ {
      nextQueue := make([]string, 0)
      for _, cur := range queue {
        next := append([]string(nil), s.forwardCallAdj[cur]...)
        next = append(next, s.implementorsAdj[cur]...)
        for _, to := range next {
          if seen[to] {
            continue
          }
          if target[to] {
            return true
          }
          seen[to] = true
          nextQueue = append(nextQueue, to)
        }
      }
      queue = nextQueue
    }
  }
  return false
}

func (s *Server) exportEntries(query string) []exportEntry {
  exported := s.exportedNodeSources()
  tokens := queryTokens(query)
  whole := strings.ToLower(strings.TrimSpace(query))
  out := make([]exportEntry, 0, len(exported))
  for id, source := range exported {
    node := s.graph.Nodes[id]
    if node == nil || node.External || s.ignored[node.File] {
      continue
    }
    if whole != "" && !exportEntryMatches(node, source, tokens, whole, s.relFile(node.File)) {
      continue
    }
    out = append(out, exportEntry{
      name:        node.Name,
      exportNames: append([]string(nil), source.names...),
      kind:        node.Kind,
      file:        s.relFile(node.File),
      line:        s.declLine(node),
      handle:      nodeHandle(node.ID),
      sources:     append([]string(nil), source.sources...),
      valueCalls:  s.edgeCountFrom(node.ID, graph.EdgeValueCall),
      valueUses:   s.edgeCountFrom(node.ID, graph.EdgeValueAccess),
      typeRefs:    s.edgeCountFrom(node.ID, graph.EdgeTypeRef),
      dependents:  len(s.reverseAdj[node.ID]),
    })
  }
  sort.Slice(out, func(i, j int) bool {
    if out[i].file != out[j].file {
      return out[i].file < out[j].file
    }
    if out[i].line != out[j].line {
      return out[i].line < out[j].line
    }
    if out[i].name != out[j].name {
      return out[i].name < out[j].name
    }
    return out[i].kind < out[j].kind
  })
  return out
}

func (s *Server) renderExportEntries(entries []exportEntry, query string, offset int, limit int) string {
  var b strings.Builder
  b.WriteString(exportHeader)
  total := len(entries)
  if query = strings.TrimSpace(query); query != "" {
    fmt.Fprintf(&b, "Filter: %q\n", query)
  }
  if total == 0 {
    b.WriteString("No exported graph symbols match.\n")
    return strings.TrimRight(b.String(), "\n")
  }
  if offset > total {
    offset = total
  }
  end := offset + limit
  if end > total {
    end = total
  }
  if limit == 0 {
    fmt.Fprintf(&b, "Exports: showing 0 of %d. Use a positive limit to list symbols.\n", total)
  } else {
    fmt.Fprintf(&b, "Exports: showing %d-%d of %d. Use offset:%d for next page.\n", offset+1, end, total, end)
  }
  writeExportFolderSummary(&b, entries)
  if limit == 0 {
    return strings.TrimRight(b.String(), "\n")
  }
  b.WriteString("\nExported symbols:\n")
  for i := offset; i < end; i++ {
    entry := entries[i]
    exportedAs := strings.Join(entry.exportNames, ",")
    if exportedAs == "" {
      exportedAs = entry.name
    }
    fmt.Fprintf(&b, "  %s %s  exports:%s  %s:%d  handle:%s  calls:%d uses:%d types:%d deps:%d  sources:%s\n", entry.kind, entry.name, exportedAs, entry.file, entry.line, entry.handle, entry.valueCalls, entry.valueUses, entry.typeRefs, entry.dependents, strings.Join(entry.sources, "; "))
  }
  if end < total {
    fmt.Fprintf(&b, "... (%d more exports; call query_exports with offset:%d)\n", total-end, end)
  }
  return strings.TrimRight(b.String(), "\n")
}

func writeExportFolderSummary(b *strings.Builder, entries []exportEntry) {
  counts := map[string]int{}
  kinds := map[string]map[graph.NodeKind]int{}
  for _, entry := range entries {
    folder := topFolder(entry.file)
    counts[folder]++
    if kinds[folder] == nil {
      kinds[folder] = map[graph.NodeKind]int{}
    }
    kinds[folder][entry.kind]++
  }
  folders := make([]string, 0, len(counts))
  for folder := range counts {
    folders = append(folders, folder)
  }
  sort.Strings(folders)
  b.WriteString("Export folders:\n")
  for _, folder := range folders {
    fmt.Fprintf(b, "  %s: total=%d", folder, counts[folder])
    for _, kind := range []graph.NodeKind{graph.NodeClass, graph.NodeInterface, graph.NodeTypeAlias, graph.NodeFunction, graph.NodeVariable, graph.NodeEnum, graph.NodeMethod} {
      if n := kinds[folder][kind]; n > 0 {
        fmt.Fprintf(b, " %s=%d", kind, n)
      }
    }
    b.WriteByte('\n')
  }
}

func topFolder(file string) string {
  file = strings.Trim(file, "/")
  if file == "" {
    return "."
  }
  if idx := strings.IndexByte(file, '/'); idx >= 0 {
    return file[:idx]
  }
  return "."
}

func (s *Server) edgeCountFrom(id string, kind graph.EdgeKind) int {
  count := 0
  for _, edge := range s.graph.Edges {
    if edge.From == id && edge.Kind == kind {
      count++
    }
  }
  return count
}

func exportEntryMatches(node *graph.Node, info exportInfo, tokens []string, whole string, file string) bool {
  name := strings.ToLower(node.Name)
  path := strings.ToLower(file)
  if strings.Contains(name, whole) || strings.Contains(path, whole) {
    return true
  }
  for _, exportName := range info.names {
    if strings.Contains(strings.ToLower(exportName), whole) {
      return true
    }
  }
  for _, source := range info.sources {
    if strings.Contains(strings.ToLower(source), whole) {
      return true
    }
  }
  for _, token := range tokens {
    if strings.Contains(name, token) || strings.Contains(path, token) {
      return true
    }
    for _, exportName := range info.names {
      if strings.Contains(strings.ToLower(exportName), token) {
        return true
      }
    }
    for _, source := range info.sources {
      if strings.Contains(strings.ToLower(source), token) {
        return true
      }
    }
  }
  return false
}

func (s *Server) exportedNodeSources() map[string]exportInfo {
  out := make(map[string]exportInfo)
  if s.prog == nil || s.prog.Checker == nil {
    return out
  }
  byDecl := s.nodesByDeclarationSpan()
  s.collectDirectExports(out, byDecl)
  for _, file := range s.prog.SourceFiles() {
    if file == nil || file.Symbol == nil {
      continue
    }
    for _, symbol := range shimchecker.Checker_getExportsOfModule(s.prog.Checker, file.Symbol) {
      target := exportedTargetSymbol(s.prog.Checker, symbol)
      if target == nil {
        continue
      }
      for _, declaration := range target.Declarations {
        if node := byDecl[declarationSpanKey(declaration)]; node != nil {
          appendExportInfo(out, node.ID, symbol.Name, exportSource(s.relFile(file.FileName()), symbol, target))
        }
      }
    }
  }
  s.collectExportedMembers(out, byDecl)
  return out
}

func (s *Server) collectDirectExports(out map[string]exportInfo, byDecl map[declarationKey]*graph.Node) {
  if s.prog == nil {
    return
  }
  for _, file := range s.prog.SourceFiles() {
    if file == nil || file.Statements == nil {
      continue
    }
    for _, statement := range file.Statements.Nodes {
      if statement == nil || shimast.GetCombinedModifierFlags(statement)&shimast.ModifierFlagsExport == 0 {
        continue
      }
      switch statement.Kind {
      case shimast.KindVariableStatement:
        variables := statement.AsVariableStatement()
        if variables == nil || variables.DeclarationList == nil {
          continue
        }
        list := variables.DeclarationList.AsVariableDeclarationList()
        if list == nil || list.Declarations == nil {
          continue
        }
        for _, binding := range list.Declarations.Nodes {
          if node := byDecl[declarationSpanKey(binding)]; node != nil {
            appendExportInfo(out, node.ID, node.Name, "exported declaration")
          }
        }
      default:
        if node := byDecl[declarationSpanKey(statement)]; node != nil {
          appendExportInfo(out, node.ID, node.Name, "exported declaration")
        }
      }
    }
  }
}

func appendExportInfo(out map[string]exportInfo, id string, name string, source string) {
  if id == "" {
    return
  }
  info := out[id]
  if name != "" && !containsString(info.names, name) {
    info.names = append(info.names, name)
    sort.Strings(info.names)
  }
  if source != "" && !containsString(info.sources, source) {
    info.sources = append(info.sources, source)
    sort.Strings(info.sources)
  }
  out[id] = info
}

func containsString(values []string, value string) bool {
  for _, existing := range values {
    if existing == value {
      return true
    }
  }
  return false
}

func (s *Server) collectExportedMembers(out map[string]exportInfo, byDecl map[declarationKey]*graph.Node) {
  exportedOwners := map[string]exportInfo{}
  for id, info := range out {
    node := s.graph.Nodes[id]
    if node == nil || (node.Kind != graph.NodeClass && node.Kind != graph.NodeInterface) {
      continue
    }
    exportedOwners[node.ID] = info
  }
  if len(exportedOwners) == 0 || s.prog == nil {
    return
  }
  for _, file := range s.prog.SourceFiles() {
    if file == nil || file.Statements == nil {
      continue
    }
    s.collectExportedMembersIn(out, byDecl, exportedOwners, file.Statements.Nodes)
  }
}

func (s *Server) collectExportedMembersIn(out map[string]exportInfo, byDecl map[declarationKey]*graph.Node, exportedOwners map[string]exportInfo, statements []*shimast.Node) {
  for _, statement := range statements {
    switch statement.Kind {
    case shimast.KindClassDeclaration, shimast.KindInterfaceDeclaration:
      owner := byDecl[declarationSpanKey(statement)]
      ownerInfo, ownerExported := exportedOwners[nodeID(owner)]
      if ownerExported {
        for _, member := range memberNodes(statement) {
          if !exportedMemberVisible(member) {
            continue
          }
          if node := byDecl[declarationSpanKey(member)]; node != nil {
            appendExportInfo(out, node.ID, node.Name, exportedMemberSource(ownerInfo))
          }
        }
      }
    case shimast.KindModuleDeclaration:
      s.collectExportedMembersIn(out, byDecl, exportedOwners, moduleMemberStatements(statement))
    }
  }
}

func nodeID(node *graph.Node) string {
  if node == nil {
    return ""
  }
  return node.ID
}

func exportedMemberVisible(member *shimast.Node) bool {
  if member == nil {
    return false
  }
  switch member.Kind {
  case shimast.KindMethodDeclaration, shimast.KindMethodSignature,
    shimast.KindConstructor, shimast.KindGetAccessor, shimast.KindSetAccessor,
    shimast.KindPropertyDeclaration, shimast.KindPropertySignature:
  default:
    return false
  }
  flags := shimast.GetCombinedModifierFlags(member)
  return flags&(shimast.ModifierFlagsPrivate|shimast.ModifierFlagsProtected) == 0
}

func exportedMemberSource(owner exportInfo) string {
  if len(owner.names) == 0 {
    return "exported member"
  }
  return "member of exported " + strings.Join(owner.names, ",")
}

func memberNodes(statement *shimast.Node) []*shimast.Node {
  switch statement.Kind {
  case shimast.KindClassDeclaration:
    if decl := statement.AsClassDeclaration(); decl != nil && decl.Members != nil {
      return decl.Members.Nodes
    }
  case shimast.KindInterfaceDeclaration:
    if decl := statement.AsInterfaceDeclaration(); decl != nil && decl.Members != nil {
      return decl.Members.Nodes
    }
  }
  return nil
}

func moduleMemberStatements(statement *shimast.Node) []*shimast.Node {
  body := statement.Body()
  for body != nil && body.Kind == shimast.KindModuleDeclaration {
    body = body.Body()
  }
  if body == nil || body.Kind != shimast.KindModuleBlock {
    return nil
  }
  block := body.AsModuleBlock()
  if block == nil || block.Statements == nil {
    return nil
  }
  return block.Statements.Nodes
}

func exportedTargetSymbol(checker *shimchecker.Checker, symbol *shimast.Symbol) *shimast.Symbol {
  if symbol == nil {
    return nil
  }
  if symbol.Flags&shimast.SymbolFlagsAlias != 0 {
    if aliased := shimchecker.Checker_getAliasedSymbol(checker, symbol); aliased != nil {
      return aliased
    }
  }
  return symbol
}

func exportSource(file string, exported *shimast.Symbol, target *shimast.Symbol) string {
  if exported == nil {
    return "export"
  }
  name := exported.Name
  if target != nil && target.Name != "" && target.Name != exported.Name {
    return fmt.Sprintf("export %s=%s from %s", name, target.Name, filepath.ToSlash(file))
  }
  return fmt.Sprintf("export %s from %s", name, filepath.ToSlash(file))
}

type declarationKey struct {
  file string
  pos  int
  end  int
}

func (s *Server) nodesByDeclarationSpan() map[declarationKey]*graph.Node {
  out := make(map[declarationKey]*graph.Node, len(s.graph.Nodes))
  for _, node := range s.graph.Nodes {
    out[declarationKey{file: node.File, pos: node.Pos, end: node.End}] = node
  }
  return out
}

func declarationSpanKey(declaration *shimast.Node) declarationKey {
  if declaration == nil {
    return declarationKey{}
  }
  file := ""
  if source := shimast.GetSourceFileOfNode(declaration); source != nil {
    file = source.FileName()
  }
  return declarationKey{file: file, pos: declaration.Pos(), end: declaration.End()}
}

const (
  maxExpandNodeRefs = 8
  expandBudgetBase  = 18000
  expandBudgetStep  = 9000
  expandBudgetMax   = 48000
)

func expandBudget(nodes int) int {
  if nodes < 1 {
    nodes = 1
  }
  budget := expandBudgetBase + expandBudgetStep*(nodes-1)
  if budget > expandBudgetMax {
    return expandBudgetMax
  }
  return budget
}

// expandNodes reopens exact graph nodes by the short handles printed by
// query_nodes/query_files. It is the deterministic follow-up path for budgeted
// signatures: no fuzzy re-ranking and no shell read for TypeScript declarations
// already known to the graph.
func (s *Server) expandNodes(args json.RawMessage) (any, *rpcError) {
  var in struct {
    IDs  []string `json:"ids"`
    Mode string   `json:"mode"`
  }
  if err := json.Unmarshal(args, &in); err != nil {
    return nil, &rpcError{Code: codeInvalidParams, Message: "expand_nodes: invalid arguments"}
  }
  refs := make([]string, 0, len(in.IDs))
  for _, id := range in.IDs {
    if strings.TrimSpace(id) != "" {
      refs = append(refs, id)
    }
  }
  if len(refs) == 0 {
    return nil, &rpcError{Code: codeInvalidParams, Message: "expand_nodes requires a non-empty 'ids' array"}
  }
  if len(refs) > maxExpandNodeRefs {
    return nil, &rpcError{Code: codeInvalidParams, Message: fmt.Sprintf("expand_nodes accepts at most %d ids", maxExpandNodeRefs)}
  }
  mode := strings.TrimSpace(in.Mode)
  if mode == "" {
    mode = "source"
  }
  if mode != "source" && mode != "flow" {
    return nil, &rpcError{Code: codeInvalidParams, Message: "expand_nodes mode must be source or flow"}
  }
  if err := s.ensureLoaded(); err != nil {
    return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
  }
  s.refreshIfStale()
  s.refreshDiagnostics()

  nodes := make([]*graph.Node, 0, len(refs))
  missing := make([]string, 0)
  seen := map[string]bool{}
  for _, ref := range refs {
    node := s.nodeByRef(ref)
    if node == nil {
      missing = append(missing, ref)
      continue
    }
    if seen[node.ID] {
      continue
    }
    seen[node.ID] = true
    nodes = append(nodes, node)
  }
  if len(nodes) == 0 {
    return textResult(fmt.Sprintf("No graph nodes match handle(s): %s.", strings.Join(missing, ", "))), nil
  }
  note := ""
  if len(missing) > 0 {
    note = "Missing handle(s): " + strings.Join(missing, ", ")
  }
  if mode == "flow" {
    names := make([]string, 0, len(nodes))
    for _, node := range nodes {
      names = append(names, node.Name)
    }
    flowQuery := strings.Join(names, " ")
    nodes = s.withCallPath(nodes, maxPathNodes, flowQuery)
    nodes = s.filterFlowNodes(nodes, flowQuery)
    return textResult(s.renderFlowNodes(nodes, flowQuery, note)), nil
  }
  return textResult(s.renderExpandedNodes(nodes, expandBudget(len(nodes)), note)), nil
}

// queryFiles renders a roster for one or more files: each file's adjacent files
// and the declarations inside it, one result block per requested location in input
// order. It is the cheap "what is in this file and what is near it" index; the
// bodies and per-symbol relationships are a query_nodes job.
func (s *Server) queryFiles(args json.RawMessage) (any, *rpcError) {
  var in struct {
    Locations []string `json:"locations"`
  }
  if err := json.Unmarshal(args, &in); err != nil {
    return nil, &rpcError{Code: codeInvalidParams, Message: "query_files: invalid arguments"}
  }
  locations := make([]string, 0, len(in.Locations))
  for _, loc := range in.Locations {
    if strings.TrimSpace(loc) != "" {
      locations = append(locations, loc)
    }
  }
  if len(locations) == 0 {
    return nil, &rpcError{Code: codeInvalidParams, Message: "query_files requires a non-empty 'locations'"}
  }
  if err := s.ensureLoaded(); err != nil {
    return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
  }
  s.refreshIfStale()
  s.refreshDiagnostics()
  return textBlocks(s.fileBlocks(locations)), nil
}

// renderNodes writes the standard graph view (header, each node's edges, blast
// radius, and budgeted source) for a set of nodes, collapsing nodes past the
// budget to a one-line signature so one call never floods the context. note is an
// optional line prepended after the header (e.g. names that matched nothing).
func (s *Server) renderNodes(nodes []*graph.Node, budget int, note string) string {
  return s.renderNodesWithSourceLimit(nodes, budget, note, maxSourceLines)
}

func (s *Server) renderExpandedNodes(nodes []*graph.Node, budget int, note string) string {
  var b strings.Builder
  b.WriteString(expandHeader)
  if note != "" {
    b.WriteString(note)
    b.WriteByte('\n')
  }
  collapsed := 0
  sourceLines := expandedSourceLines(len(nodes))
  for _, node := range nodes {
    withSource := b.Len() < budget
    if !withSource {
      collapsed++
      s.writeNodeHeader(&b, node)
      continue
    }
    s.writeExpandedNodeSource(&b, node, sourceLines)
  }
  if collapsed > 0 {
    fmt.Fprintf(&b, "(%d further node(s) shown as signatures to fit the response budget)\n", collapsed)
  }
  return strings.TrimRight(b.String(), "\n")
}

func (s *Server) renderNodesWithSourceLimit(nodes []*graph.Node, budget int, note string, sourceLines int) string {
  var b strings.Builder
  b.WriteString(exploreHeader)
  if note != "" {
    b.WriteString(note)
    b.WriteByte('\n')
  }
  collapsed := 0
  for _, node := range nodes {
    withSource := b.Len() < budget
    if !withSource {
      collapsed++
    }
    s.writeNodeRelations(&b, node, withSource, sourceLines)
  }
  if collapsed > 0 {
    fmt.Fprintf(&b, "(%d further node(s) shown as signatures to fit the response budget)\n", collapsed)
  }
  return strings.TrimRight(b.String(), "\n")
}

// renderFlowNodes writes a compact implementation trace for call-path questions.
// The graph is an index: print the selected route, the checker-resolved value
// edges, and only the source lines tied to those edge spans. Full bodies stay
// behind expand_nodes so a flow answer does not become a file dump.
func (s *Server) renderFlowNodes(nodes []*graph.Node, query string, note string) string {
  var b strings.Builder
  b.WriteString(flowHeader)
  if note != "" {
    b.WriteString(note)
    b.WriteByte('\n')
  }
  included := make(map[string]bool, len(nodes))
  for _, node := range nodes {
    included[node.ID] = true
  }
  b.WriteString("Flow nodes:\n")
  for i, node := range nodes {
    fmt.Fprintf(&b, "  %d. %s %s  %s:%d  handle:%s\n", i+1, node.Kind, node.Name, s.relFile(node.File), s.declLine(node), nodeHandle(node.ID))
  }
  b.WriteByte('\n')
  s.writeFlowEvidence(&b, nodes, included, query)
  s.writeFlowSourceEvidence(&b, nodes, included, query)
  s.writeFocusedFlowSourceWindows(&b, nodes, included, query)
  return strings.TrimRight(b.String(), "\n")
}

func (s *Server) filterFlowNodes(nodes []*graph.Node, query string) []*graph.Node {
  tokens := queryTokens(query)
  words := queryWords(query)
  out := make([]*graph.Node, 0, len(nodes))
  for i, node := range nodes {
    if node == nil || !flowNodeEligible(node) {
      continue
    }
    if i == 0 || s.pathTargetScore(node.ID, tokens, words) > 0 {
      out = append(out, node)
      if len(out) >= maxFlowNodes {
        break
      }
    }
  }
  if len(out) == 0 {
    return nodes
  }
  return out
}

const maxFlowNodes = 16

func flowNodeEligible(node *graph.Node) bool {
  switch strings.ToLower(string(node.Kind)) {
  case "class", "interface", "type":
    return false
  default:
    return true
  }
}

// maxPathNodes caps how many downstream call-path nodes a flow query pulls in
// beyond its direct matches, so one query returns the chain without a hub
// exploding the response. The render budget collapses the tail past it.
const maxPathNodes = 16

const maxPathBranch = 8

// withCallPath appends to the matched seeds the declarations downstream of them
// along value-call edges (the runtime call flow), breadth-first and bounded, so a
// single flow query returns the path instead of forcing a follow-up query per hop.
// Seeds, external nodes, and anything past the depth or node caps are skipped, and
// the breadth-first order keeps the immediate next hops first so they render with
// their bodies before the budget collapses the rest.
func (s *Server) withCallPath(seeds []*graph.Node, max int, query string) []*graph.Node {
  const maxDepth = 5
  tokens := queryTokens(query)
  words := queryWords(query)
  if anchored := s.withAnchoredCallPath(seeds, max, query, tokens, words); len(anchored) > 0 {
    return anchored
  }
  inSet := make(map[string]bool, len(seeds))
  depth := make(map[string]int, len(seeds))
  priority := make(map[string]int, len(seeds))
  queue := make([]string, 0, len(seeds))
  for _, n := range seeds {
    inSet[n.ID] = true
    depth[n.ID] = 0
    queue = append(queue, n.ID)
  }
  out := append([]*graph.Node(nil), seeds...)
  added := 0
  for len(queue) > 0 && added < max {
    cur := queue[0]
    queue = queue[1:]
    if depth[cur] > 0 {
      if node := s.graph.Nodes[cur]; node != nil {
        out = append(out, node)
        added++
        if added >= max {
          break
        }
      }
    }
    if depth[cur] >= maxDepth {
      continue
    }
    // Follow the call flow forward, and at each step cross the dynamic-dispatch
    // seam to any concrete implementors, so an interface method on the path
    // brings its real body along instead of forcing a separate query. Targets
    // whose names match the question's domain nouns come first, so the path
    // reaches named work before generic helpers.
    next := s.rankedPathTargets(cur, tokens, words)
    if len(next) > maxPathBranch {
      next = next[:maxPathBranch]
    }
    for _, to := range next {
      if inSet[to] {
        continue
      }
      node := s.graph.Nodes[to]
      // Skip external and git-ignored generated targets: the call path stays in
      // authored code, the same de-surfacing the matcher applies.
      if node == nil || node.External || s.ignored[node.File] {
        continue
      }
      inSet[to] = true
      depth[to] = depth[cur] + 1
      priority[to] = s.pathTargetScoreFrom(cur, to, tokens, words)
      queue = append(queue, to)
      sortPathQueue(queue, priority)
    }
  }
  return out
}

func (s *Server) withAnchoredCallPath(seeds []*graph.Node, max int, query string, tokens []string, words map[string]bool) []*graph.Node {
  anchors := flowAnchors(query, seeds, words)
  if len(anchors) < 2 {
    return nil
  }
  out := make([]*graph.Node, 0, max)
  seen := map[string]bool{}
  add := func(id string) {
    if len(out) >= max || seen[id] {
      return
    }
    node := s.graph.Nodes[id]
    if node == nil || !flowNodeEligible(node) || node.External || s.ignored[node.File] {
      return
    }
    seen[id] = true
    out = append(out, node)
  }
  add(anchors[0].ID)
  for i := 1; i < len(anchors) && len(out) < max; i++ {
    path := s.shortestFlowPath(anchors[i-1].ID, anchors[i].ID, tokens, words)
    if len(path) == 0 {
      add(anchors[i].ID)
      continue
    }
    for _, id := range path[1:] {
      add(id)
    }
  }
  if len(out) < 2 {
    return nil
  }
  return out
}

type flowAnchor struct {
  *graph.Node
  pos   int
  order int
}

func flowAnchors(query string, seeds []*graph.Node, words map[string]bool) []flowAnchor {
  whole := strings.ToLower(query)
  anchors := make([]flowAnchor, 0, len(seeds))
  seen := map[string]bool{}
  for order, node := range seeds {
    if node == nil || seen[node.ID] {
      continue
    }
    name := strings.ToLower(node.Name)
    pos := strings.Index(whole, name)
    if pos < 0 {
      member := strings.ToLower(memberName(node.Name))
      if member == name || !words[member] {
        continue
      }
      if !naturalDottedAnchor(node.Name, words) &&
        !(exactLongMemberAnchor(node.Name, words) && flowMemberAnchorEligible(node)) {
        continue
      }
      pos = strings.Index(whole, member)
      if pos < 0 {
        continue
      }
    }
    seen[node.ID] = true
    anchors = append(anchors, flowAnchor{Node: node, pos: pos, order: order})
  }
  sort.SliceStable(anchors, func(i, j int) bool {
    if anchors[i].pos != anchors[j].pos {
      return anchors[i].pos < anchors[j].pos
    }
    return anchors[i].order < anchors[j].order
  })
  return anchors
}

func flowMemberAnchorEligible(node *graph.Node) bool {
  return node != nil && (node.Kind == graph.NodeMethod || node.Kind == graph.NodeFunction)
}

func (s *Server) shortestFlowPath(fromID, toID string, tokens []string, words map[string]bool) []string {
  const maxDepth = 8
  if fromID == toID {
    return []string{fromID}
  }
  type step struct {
    id   string
    path []string
  }
  queue := []step{{id: fromID, path: []string{fromID}}}
  seen := map[string]bool{fromID: true}
  for len(queue) > 0 {
    cur := queue[0]
    queue = queue[1:]
    if len(cur.path) > maxDepth {
      continue
    }
    next := s.allFlowTargets(cur.id, toID, tokens, words)
    for _, id := range next {
      if seen[id] {
        continue
      }
      node := s.graph.Nodes[id]
      if node == nil || node.External || s.ignored[node.File] || !flowNodeEligible(node) {
        continue
      }
      path := append(append([]string(nil), cur.path...), id)
      if id == toID {
        return path
      }
      seen[id] = true
      queue = append(queue, step{id: id, path: path})
    }
  }
  return nil
}

func (s *Server) allFlowTargets(cur string, target string, tokens []string, words map[string]bool) []string {
  seen := map[string]bool{}
  out := make([]string, 0, len(s.forwardCallAdj[cur])+len(s.implementorsAdj[cur]))
  for _, id := range s.forwardCallAdj[cur] {
    if !seen[id] {
      seen[id] = true
      out = append(out, id)
    }
  }
  for _, id := range s.implementorsAdj[cur] {
    if !seen[id] {
      seen[id] = true
      out = append(out, id)
    }
  }
  sort.SliceStable(out, func(i, j int) bool {
    if out[i] == target {
      return true
    }
    if out[j] == target {
      return false
    }
    left := s.pathTargetScoreFrom(cur, out[i], tokens, words)
    right := s.pathTargetScoreFrom(cur, out[j], tokens, words)
    if left != right {
      return left > right
    }
    return out[i] < out[j]
  })
  return out
}

func sortPathQueue(queue []string, priority map[string]int) {
  sort.SliceStable(queue, func(i, j int) bool {
    left := priority[queue[i]]
    right := priority[queue[j]]
    if left != right {
      return left > right
    }
    return queue[i] < queue[j]
  })
}

func (s *Server) rankedPathTargets(cur string, tokens []string, words map[string]bool) []string {
  seen := map[string]bool{}
  next := make([]string, 0, len(s.forwardCallAdj[cur])+len(s.implementorsAdj[cur]))
  for _, id := range s.forwardCallAdj[cur] {
    if !seen[id] {
      seen[id] = true
      next = append(next, id)
    }
  }
  for _, id := range s.implementorsAdj[cur] {
    if !seen[id] {
      seen[id] = true
      next = append(next, id)
    }
  }
  if s.allowsReverseConsumerSource(cur) {
    for _, id := range s.rankedReverseConsumers(cur, tokens, words) {
      if !seen[id] {
        seen[id] = true
        next = append(next, id)
      }
    }
  }
  sort.Slice(next, func(i, j int) bool {
    left := s.pathTargetScoreFrom(cur, next[i], tokens, words)
    right := s.pathTargetScoreFrom(cur, next[j], tokens, words)
    if left != right {
      return left > right
    }
    return next[i] < next[j]
  })
  positive := 0
  for _, id := range next {
    if s.pathTargetScoreFrom(cur, id, tokens, words) <= 0 {
      break
    }
    positive++
  }
  if positive > 0 {
    next = next[:positive]
  }
  return next
}

func (s *Server) allowsReverseConsumerSource(id string) bool {
  node := s.graph.Nodes[id]
  return node != nil && node.Kind == graph.NodeVariable
}

const maxReverseConsumerBranch = 3

func (s *Server) rankedReverseConsumers(cur string, tokens []string, words map[string]bool) []string {
  candidates := append([]string(nil), s.reverseValueAdj[cur]...)
  preferredOwners := s.queryOwnerHints(candidates, words)
  sort.Slice(candidates, func(i, j int) bool {
    left := s.pathTargetScoreFrom(cur, candidates[i], tokens, words)
    right := s.pathTargetScoreFrom(cur, candidates[j], tokens, words)
    if left != right {
      return left > right
    }
    return candidates[i] < candidates[j]
  })
  out := make([]string, 0, maxReverseConsumerBranch)
  seen := map[string]bool{}
  for _, id := range candidates {
    if seen[id] || s.pathTargetScoreFrom(cur, id, tokens, words) <= 0 {
      continue
    }
    node := s.graph.Nodes[id]
    if node == nil || node.External || s.ignored[node.File] || !flowNodeEligible(node) {
      continue
    }
    if len(preferredOwners) > 0 && !preferredOwners[ownerOf(node.Name)] {
      continue
    }
    seen[id] = true
    out = append(out, id)
    if len(out) >= maxReverseConsumerBranch {
      break
    }
  }
  return out
}

func (s *Server) queryOwnerHints(ids []string, words map[string]bool) map[string]bool {
  owners := map[string]bool{}
  for _, id := range ids {
    node := s.graph.Nodes[id]
    if node == nil {
      continue
    }
    owner := ownerOf(node.Name)
    if owner != "" && words[owner] {
      owners[owner] = true
    }
  }
  return owners
}

func (s *Server) pathTargetScoreFrom(fromID, toID string, tokens []string, words map[string]bool) int {
  score := s.pathTargetScore(toID, tokens, words)
  from := s.graph.Nodes[fromID]
  to := s.graph.Nodes[toID]
  if from == nil || to == nil {
    return score
  }
  if score > 0 && ownerOf(from.Name) != "" && ownerOf(from.Name) == ownerOf(to.Name) {
    score += 80
  }
  return score
}

func (s *Server) pathTargetScore(id string, tokens []string, words map[string]bool) int {
  node := s.graph.Nodes[id]
  if node == nil {
    return 0
  }
  name := strings.ToLower(node.Name)
  member := strings.ToLower(memberName(node.Name))
  score := naturalDottedScore(node.Name, words) + exactMemberScore(node.Name, words)
  for _, token := range tokens {
    switch {
    case name == token:
      score += 120
    case member == token:
      score += 120
    case strings.HasPrefix(member, token):
      score += 60
    case strings.Contains(member, token):
      score += 35
    }
  }
  for word := range words {
    if len(word) < 2 {
      continue
    }
    switch {
    case member == word:
      score += 90
    case strings.HasPrefix(member, word):
      score += 55
    case strings.Contains(member, word):
      score += 35
    }
  }
  return score
}

func ownerOf(name string) string {
  owner, _, ok := dottedNameParts(name)
  if !ok {
    return ""
  }
  return strings.ToLower(owner)
}

// textBlocks wraps one text block per result item into the MCP content envelope
// (always an object), preserving order: a multi-input call returns one content
// block per requested name/location, in the order given, each headed with the
// identifier it answers, so the agent can map results back to its inputs.
func textBlocks(blocks []string) any {
  content := make([]any, 0, len(blocks))
  for _, t := range blocks {
    content = append(content, map[string]any{"type": "text", "text": t})
  }
  return map[string]any{"content": content}
}

func nodeHandle(id string) string {
  h := fnv.New64a()
  _, _ = h.Write([]byte(id))
  return fmt.Sprintf("n:%016x", h.Sum64())
}

func (s *Server) nodeByRef(ref string) *graph.Node {
  ref = normalizeNodeRef(ref)
  if ref == "" {
    return nil
  }
  if node := s.graph.Nodes[ref]; node != nil {
    return node
  }
  if !strings.HasPrefix(ref, "n:") {
    return nil
  }
  for _, node := range s.graph.Nodes {
    if nodeHandle(node.ID) == ref {
      return node
    }
  }
  return nil
}

func normalizeNodeRef(ref string) string {
  ref = strings.TrimSpace(ref)
  if strings.HasPrefix(ref, "handle:") {
    ref = strings.TrimPrefix(ref, "handle:")
  }
  return ref
}

// fileBlocks renders one roster block per requested location, in input order, each
// headed with the location. The roster is a cheap index, not a content dump: the
// file's adjacent files (the ones its declarations reach and are reached by, at
// file granularity) and a flat list of the declarations inside it (kind, name,
// line). Bodies and per-symbol edges are a query_nodes job; query_files just tells
// the agent what is in a file and what sits next to it, so it can query the right
// symbol next.
func (s *Server) fileBlocks(locations []string) []string {
  blocks := make([]string, 0, len(locations))
  for _, loc := range locations {
    var b strings.Builder
    fmt.Fprintf(&b, "## %s\n", loc)
    files := s.resolveFile(loc)
    if len(files) == 0 {
      fmt.Fprintf(&b, "No project source file matches %q.", loc)
      blocks = append(blocks, b.String())
      continue
    }
    sort.Strings(files)
    for _, f := range files {
      ids := make(map[string]bool)
      var nodes []*graph.Node
      for _, node := range s.graph.Nodes {
        if node.File == f {
          ids[node.ID] = true
          nodes = append(nodes, node)
        }
      }
      sort.Slice(nodes, func(i, j int) bool { return s.declLine(nodes[i]) < s.declLine(nodes[j]) })
      // File-level adjacency: walk the edges once and bucket the neighbor's
      // file by direction, skipping edges that stay inside this file.
      reaches := make(map[string]bool)
      reachedBy := make(map[string]bool)
      for _, edge := range s.graph.Edges {
        fromIn, toIn := ids[edge.From], ids[edge.To]
        if fromIn && !toIn {
          if to := s.graph.Nodes[edge.To]; to != nil && to.File != "" {
            reaches[s.relFile(to.File)] = true
          }
        }
        if toIn && !fromIn {
          if from := s.graph.Nodes[edge.From]; from != nil && from.File != "" {
            reachedBy[s.relFile(from.File)] = true
          }
        }
      }
      fmt.Fprintf(&b, "%s (%d declarations):\n", s.relFile(f), len(nodes))
      writeFileAdjacency(&b, "reaches", reaches)
      writeFileAdjacency(&b, "reached by", reachedBy)
      for _, node := range nodes {
        external := ""
        if node.External {
          external = " (external)"
        }
        fmt.Fprintf(&b, "  %s %s%s  :%d  handle:%s\n", node.Kind, node.Name, external, s.declLine(node), nodeHandle(node.ID))
      }
    }
    blocks = append(blocks, strings.TrimRight(b.String(), "\n"))
  }
  return blocks
}

// maxAdjacentFiles caps the adjacency list so a hub file does not dump every
// neighbor; the overflow count is still reported.
const maxAdjacentFiles = 20

// writeFileAdjacency writes one sorted, capped line of adjacent files for a
// direction, or nothing when there are none.
func writeFileAdjacency(b *strings.Builder, label string, set map[string]bool) {
  if len(set) == 0 {
    return
  }
  files := make([]string, 0, len(set))
  for f := range set {
    files = append(files, f)
  }
  sort.Strings(files)
  if len(files) > maxAdjacentFiles {
    fmt.Fprintf(b, "  %s: %s (+%d more)\n", label, strings.Join(files[:maxAdjacentFiles], ", "), len(files)-maxAdjacentFiles)
  } else {
    fmt.Fprintf(b, "  %s: %s\n", label, strings.Join(files, ", "))
  }
}

const exploreHeader = "Compiler-resolved graph snapshot. Answer from printed edges/source; expand only omitted declarations. Re-query after edits.\n\n"

const exportHeader = "Compiler-resolved exported symbol index. Use exact names/handles from here for query_nodes or expand_nodes. Git-ignored files are omitted.\n\n"

const flowHeader = "Compiler-resolved call-flow briefing. Answer from this result; expand only to edit or quote omitted source.\n\n"

const expandHeader = "Exact compiler-resolved declaration source. Use query_nodes or mode:flow for relationships. Re-query after edits.\n\n"

// maxExploreNodes caps how many ranked nodes a query returns, so a broad
// keyword query surfaces the most relevant declarations without flooding context.
const maxExploreNodes = 12

// queryTokens lowercases query and splits it into alphanumeric tokens. It does
// not carry a semantic stop-word list; relevance comes from the graph index and
// string matching against node names.
func queryTokens(query string) []string {
  fields := strings.FieldsFunc(strings.ToLower(query), func(r rune) bool {
    return !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9')
  })
  tokens := make([]string, 0, len(fields))
  for _, field := range fields {
    if len(field) < 2 {
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

func dottedNameParts(name string) (string, string, bool) {
  dot := strings.LastIndexByte(name, '.')
  if dot <= 0 || dot == len(name)-1 {
    return "", "", false
  }
  owner := name[:dot]
  if ownerDot := strings.LastIndexByte(owner, '.'); ownerDot >= 0 {
    owner = owner[ownerDot+1:]
  }
  return owner, name[dot+1:], true
}

func naturalDottedScore(name string, words map[string]bool) int {
  owner, member, ok := dottedNameParts(name)
  if !ok {
    return 0
  }
  if !containsWholeWord(words, owner) || !words[strings.ToLower(member)] {
    return 0
  }
  return 650
}

func naturalDottedAnchor(name string, words map[string]bool) bool {
  owner, member, ok := dottedNameParts(name)
  if !ok {
    return false
  }
  member = strings.ToLower(member)
  return containsWholeWord(words, owner) && words[member]
}

func naturalAnchorPosition(query, name string) int {
  owner, member, ok := dottedNameParts(strings.ToLower(name))
  if !ok {
    return len(query) + 1
  }
  ownerAt := strings.Index(query, owner)
  memberAt := -1
  if ownerAt >= 0 {
    if idx := strings.Index(query[ownerAt+len(owner):], member); idx >= 0 {
      memberAt = ownerAt + len(owner) + idx
    }
  }
  if memberAt < 0 {
    memberAt = strings.Index(query, member)
  }
  switch {
  case ownerAt >= 0 && memberAt >= 0:
    return memberAt
  case ownerAt >= 0:
    return ownerAt
  case memberAt >= 0:
    return memberAt
  default:
    return len(query) + 1
  }
}

func exactMemberScore(name string, words map[string]bool) int {
  _, member, ok := dottedNameParts(name)
  if !ok {
    return 0
  }
  if words[strings.ToLower(member)] {
    return 550
  }
  return 0
}

func exactLongMemberAnchor(name string, words map[string]bool) bool {
  _, member, ok := dottedNameParts(name)
  if !ok {
    return false
  }
  member = strings.ToLower(member)
  return len(member) >= 8 && words[member]
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

  type scored struct {
    node        *graph.Node
    score       int
    dotted      bool
    exactAnchor bool
    memberAnchor bool
    anchorPos   int
  }
  ranked := make([]scored, 0)
  for _, node := range s.graph.Nodes {
    name := strings.ToLower(node.Name)
    // De-surface git-ignored generated code: keep it reachable only by an
    // exact name query, so it never dominates a broad or keyword match.
    if s.ignored[node.File] && name != whole {
      continue
    }
    score := 0
    dotted := false
    exactAnchor := false
    memberAnchor := false
    anchorPos := len(whole) + 1
    if name == whole {
      score += 1000
      exactAnchor = strings.Contains(name, ".")
      anchorPos = 0
    }
    if strings.Contains(name, ".") && strings.Contains(whole, name) {
      score += 900
      dotted = true
      exactAnchor = true
      anchorPos = strings.Index(whole, name)
    } else if naturalScore := naturalDottedScore(node.Name, words); naturalScore > 0 {
      score += naturalScore
      dotted = true
      exactAnchor = naturalDottedAnchor(node.Name, words)
      if exactAnchor {
        anchorPos = naturalAnchorPosition(whole, node.Name)
      }
    } else if memberScore := exactMemberScore(node.Name, words); memberScore > 0 {
      score += memberScore
      dotted = true
      memberAnchor = exactLongMemberAnchor(node.Name, words)
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
    ranked = append(ranked, scored{node: node, score: score, dotted: dotted, exactAnchor: exactAnchor, memberAnchor: memberAnchor, anchorPos: anchorPos})
  }
  if len(ranked) > 0 {
    sort.Slice(ranked, func(i, j int) bool {
      if ranked[i].score != ranked[j].score {
        return ranked[i].score > ranked[j].score
      }
      return ranked[i].node.ID < ranked[j].node.ID
    })
    anchors := make([]*graph.Node, 0)
    for _, r := range ranked {
      if r.exactAnchor {
        anchors = append(anchors, r.node)
        if len(anchors) >= maxExploreNodes {
          break
        }
      }
    }
    if len(anchors) > 0 {
      anchorPos := make(map[string]int, len(ranked))
      for _, r := range ranked {
        if r.exactAnchor {
          anchorPos[r.node.ID] = r.anchorPos
        }
      }
      sort.SliceStable(anchors, func(i, j int) bool {
        left := anchorPos[anchors[i].ID]
        right := anchorPos[anchors[j].ID]
        if left != right {
          return left < right
        }
        return anchors[i].ID < anchors[j].ID
      })
      seen := make(map[string]bool, len(anchors))
      for _, node := range anchors {
        seen[node.ID] = true
      }
      for _, r := range ranked {
        if len(anchors) >= maxExploreNodes {
          break
        }
        if !r.memberAnchor || seen[r.node.ID] {
          continue
        }
        seen[r.node.ID] = true
        anchors = append(anchors, r.node)
      }
      return anchors
    }
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

// writeNodeHeader writes a node's one-line signature: kind, name, an (external)
// marker when the declaration is outside the program, and its file:declLine. The
// cite is declLine (the declaration keyword, past any doc comment), the same line
// the edges to this node report, so one node is cited at one line everywhere.
func (s *Server) writeNodeHeader(b *strings.Builder, node *graph.Node) {
  external := ""
  if node.External {
    external = " (external)"
  }
  fmt.Fprintf(b, "%s %s%s  %s:%d  handle:%s\n", node.Kind, node.Name, external, s.relFile(node.File), s.declLine(node), nodeHandle(node.ID))
}

// writeNodeEdges writes a node's checker-resolved relationships: its outgoing
// edges (what it reaches) then its incoming edges (what reaches it), each capped
// at maxEdgesPerDirection with an overflow count so a central symbol does not dump
// hundreds of relationships. This is the call-path material: every edge cites the
// neighbor at its declLine and the source use line when available, so a flow can
// be followed without another call.
func (s *Server) writeNodeEdges(b *strings.Builder, node *graph.Node) {
  outgoing := make([]string, 0, maxEdgesPerDirection)
  incoming := make([]string, 0, maxEdgesPerDirection)
  outMore, inMore := 0, 0
  for _, edge := range s.graph.Edges {
    if edge.From == node.ID {
      if to := s.graph.Nodes[edge.To]; to != nil {
        if len(outgoing) < maxEdgesPerDirection {
          outgoing = append(outgoing, fmt.Sprintf("  -> (%s) %s %s  %s:%d%s", edge.Kind, to.Kind, to.Name, s.relFile(to.File), s.declLine(to), s.edgeUseSuffix(edge)))
        } else {
          outMore++
        }
      }
    }
    if edge.To == node.ID {
      if from := s.graph.Nodes[edge.From]; from != nil {
        if len(incoming) < maxEdgesPerDirection {
          incoming = append(incoming, fmt.Sprintf("  <- (%s) %s %s  %s:%d%s", edge.Kind, from.Kind, from.Name, s.relFile(from.File), s.declLine(from), s.edgeUseSuffix(edge)))
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
}

// writeNodeDiagnosticsHere writes the diagnostics that land on this declaration,
// the live error view fused onto the static structure, capped at maxNodeDiagnostics
// with the total still reported.
func (s *Server) writeNodeDiagnosticsHere(b *strings.Builder, node *graph.Node) {
  own := s.nodeDiagnostics(node)
  if len(own) == 0 {
    return
  }
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

// writeNodeBlastRadius writes the fix-safety angle: how many declarations
// transitively depend on this node and how many already carry errors, so the reach
// of an edit over current errors is visible before the edit is made.
func (s *Server) writeNodeBlastRadius(b *strings.Builder, node *graph.Node) {
  deps := s.dependents(node)
  if len(deps) == 0 {
    return
  }
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

// writeNodeRelations renders one node for query_nodes: a header, its
// outgoing/incoming checker-resolved edges, the diagnostics on it, a blast-radius
// estimate, and (when withSource) the verbatim line-numbered declaration source. A
// signature-only render (withSource false) keeps just the header to fit the budget.
func (s *Server) writeNodeRelations(b *strings.Builder, node *graph.Node, withSource bool, sourceLines int) {
  s.writeNodeHeader(b, node)
  if !withSource {
    return // past the budget: a one-line signature, no edges or body
  }
  s.writeNodeEdges(b, node)
  s.writeNodeDiagnosticsHere(b, node)
  s.writeNodeBlastRadius(b, node)
  // The body renders from the source start line (not declLine), so a leading doc
  // comment is shown with its own true line numbers.
  if source, line, sourceOffset := s.nodeSourceRange(node); source != "" {
    b.WriteString(numberLines(source, line, sourceLines))
    s.writeValueCallExcerpts(b, node, source, line, sourceOffset, sourceLines)
  }
  b.WriteString("\n")
}

// writeExpandedNodeSource renders the deterministic expand_nodes source view:
// just the known declaration body plus local diagnostics. Relationship replay
// belongs to query_nodes/flow, otherwise every source reopen becomes another
// impact-analysis dump.
func (s *Server) writeExpandedNodeSource(b *strings.Builder, node *graph.Node, sourceLines int) {
  s.writeNodeHeader(b, node)
  s.writeNodeDiagnosticsHere(b, node)
  if source, line, sourceOffset := s.nodeSourceRange(node); source != "" {
    b.WriteString(numberLines(source, line, sourceLines))
    s.writeValueCallExcerpts(b, node, source, line, sourceOffset, sourceLines)
  }
  b.WriteString("\n")
}

func (s *Server) writeFlowNode(b *strings.Builder, node *graph.Node, included map[string]bool, query string) {
  s.writeNodeHeader(b, node)
  s.writeFlowValueEdges(b, node, included)
  if source, line, sourceOffset := s.nodeSourceRange(node); source != "" {
    s.writeFlowSourceWindows(b, node, included, source, line, sourceOffset, query)
  }
  b.WriteString("\n")
}

const maxFlowEvidenceEdges = 32

func (s *Server) writeFlowEvidence(b *strings.Builder, nodes []*graph.Node, included map[string]bool, query string) {
  tokens := queryTokens(query)
  words := queryWords(query)
  type rankedEdge struct {
    edge  *graph.Edge
    score int
    line  int
  }
  edges := make([]rankedEdge, 0)
  for _, node := range nodes {
    if node == nil {
      continue
    }
    for _, edge := range s.graph.Edges {
      if edge.From != node.ID || (edge.Kind != graph.EdgeValueCall && edge.Kind != graph.EdgeValueAccess) {
        continue
      }
      to := s.graph.Nodes[edge.To]
      if to == nil {
        continue
      }
      onPath := included[edge.To]
      targetScore := s.pathTargetScoreFrom(edge.From, edge.To, tokens, words)
      if !onPath && targetScore <= 0 {
        continue
      }
      score := targetScore
      if onPath {
        score += 1000
      }
      edges = append(edges, rankedEdge{edge: edge, score: score, line: s.edgeUseLine(edge)})
    }
  }
  sort.SliceStable(edges, func(i, j int) bool {
    if edges[i].score != edges[j].score {
      return edges[i].score > edges[j].score
    }
    if edges[i].line != edges[j].line {
      return edges[i].line < edges[j].line
    }
    return edges[i].edge.From+edges[i].edge.To < edges[j].edge.From+edges[j].edge.To
  })
  if len(edges) == 0 {
    return
  }
  b.WriteString("Flow evidence:\n")
  written := 0
  seen := map[string]bool{}
  for _, ranked := range edges {
    edge := ranked.edge
    key := edge.From + "\x00" + edge.To + "\x00" + string(edge.Kind)
    if seen[key] {
      continue
    }
    seen[key] = true
    from := s.graph.Nodes[edge.From]
    to := s.graph.Nodes[edge.To]
    if from == nil || to == nil {
      continue
    }
    label := "->"
    if edge.Kind == graph.EdgeValueAccess {
      label = "~>"
    }
    fmt.Fprintf(b, "  %s %s %s  %s\n", from.Name, label, to.Name, strings.TrimSpace(s.edgeUseSuffix(edge)))
    written++
    if written >= maxFlowEvidenceEdges {
      b.WriteString("  ... (more flow evidence omitted)\n")
      break
    }
  }
  b.WriteByte('\n')
}

const (
  maxFlowSourceEvidenceLines        = 100
  maxFlowSourceEvidenceSnippetLines = 15
  maxFlowSourcePathSnippetLines     = 8
)

func (s *Server) writeFlowSourceEvidence(b *strings.Builder, nodes []*graph.Node, included map[string]bool, query string) {
  tokens := queryTokens(query)
  words := queryWords(query)
  type rankedLine struct {
    edge        *graph.Edge
    line        int
    text        string
    score       int
    targetScore int
    onPath      bool
  }
  lines := make([]rankedLine, 0)
  for _, node := range nodes {
    if node == nil {
      continue
    }
    for _, edge := range s.graph.Edges {
      if edge.From != node.ID || (edge.Kind != graph.EdgeValueCall && edge.Kind != graph.EdgeValueAccess) {
        continue
      }
      to := s.graph.Nodes[edge.To]
      if to == nil {
        continue
      }
      targetScore := s.pathTargetScoreFrom(edge.From, edge.To, tokens, words)
      onPath := included[edge.To]
      if !onPath && targetScore <= 0 {
        continue
      }
      line, text := s.edgeSourceLine(edge)
      if line == 0 || text == "" {
        continue
      }
      score := targetScore + sourceLineQueryScore(text, tokens)
      if onPath {
        score += 1000
      }
      lines = append(lines, rankedLine{edge: edge, line: line, text: text, score: score, targetScore: targetScore, onPath: onPath})
    }
  }
  sort.SliceStable(lines, func(i, j int) bool {
    if lines[i].score != lines[j].score {
      return lines[i].score > lines[j].score
    }
    leftFrom := s.graph.Nodes[lines[i].edge.From]
    rightFrom := s.graph.Nodes[lines[j].edge.From]
    leftFile, rightFile := "", ""
    if leftFrom != nil {
      leftFile = leftFrom.File
    }
    if rightFrom != nil {
      rightFile = rightFrom.File
    }
    if leftFile != rightFile {
      return leftFile < rightFile
    }
    if lines[i].line != lines[j].line {
      return lines[i].line < lines[j].line
    }
    return lines[i].edge.From+lines[i].edge.To < lines[j].edge.From+lines[j].edge.To
  })
  if len(lines) == 0 {
    return
  }
  b.WriteString("Flow source evidence:\n")
  written := 0
  seen := map[string]bool{}
  seenLines := map[string]bool{}
  for _, ranked := range lines {
    from := s.graph.Nodes[ranked.edge.From]
    to := s.graph.Nodes[ranked.edge.To]
    if from == nil || to == nil {
      continue
    }
    key := from.File + "\x00" + fmt.Sprint(ranked.line)
    if seen[key] {
      continue
    }
    label := "->"
    if ranked.edge.Kind == graph.EdgeValueAccess {
      label = "~>"
    }
    snippetLines := maxFlowSourceEvidenceSnippetLines
    if ranked.onPath {
      snippetLines = maxFlowSourcePathSnippetLines
    }
    startLine, excerpt := s.edgeSourceExcerpt(ranked.edge, snippetLines)
    if startLine == 0 || len(excerpt) == 0 {
      continue
    }
    printable := make([]struct {
      line int
      text string
    }, 0, len(excerpt))
    for i, text := range excerpt {
      line := startLine + i
      lineKey := from.File + "\x00" + fmt.Sprint(line)
      if seenLines[lineKey] {
        continue
      }
      printable = append(printable, struct {
        line int
        text string
      }{line: line, text: text})
    }
    if len(printable) == 0 {
      continue
    }
    seen[key] = true
    fmt.Fprintf(b, "  %s:%d  %s %s %s\n", s.relFile(from.File), ranked.line, from.Name, label, to.Name)
    for _, line := range printable {
      lineKey := from.File + "\x00" + fmt.Sprint(line.line)
      seenLines[lineKey] = true
      fmt.Fprintf(b, "    %d\t%s\n", line.line, clipSourceLine(strings.TrimRight(line.text, "\r"), 220))
      written++
      if written >= maxFlowSourceEvidenceLines {
        b.WriteString("  ... (more source evidence omitted)\n")
        return
      }
    }
    if written >= maxFlowSourceEvidenceLines {
      b.WriteString("  ... (more source evidence omitted)\n")
      break
    }
  }
  b.WriteByte('\n')
}

func (s *Server) writeFocusedFlowSourceWindows(b *strings.Builder, nodes []*graph.Node, included map[string]bool, query string) {
  if len(nodes) == 0 {
    return
  }
  node := nodes[len(nodes)-1]
  if node == nil {
    return
  }
  source, line, sourceOffset := s.nodeSourceRange(node)
  if source == "" {
    return
  }
  var local strings.Builder
  s.writeFlowSourceWindows(&local, node, included, source, line, sourceOffset, query)
  if local.Len() == 0 {
    return
  }
  b.WriteString("Focused terminal source windows:\n")
  fmt.Fprintf(b, "  %s %s  %s:%d  handle:%s\n", node.Kind, node.Name, s.relFile(node.File), s.declLine(node), nodeHandle(node.ID))
  b.WriteString(local.String())
  b.WriteByte('\n')
}

func (s *Server) edgeSourceExcerpt(edge *graph.Edge, maxLines int) (int, []string) {
  from := s.graph.Nodes[edge.From]
  if from == nil || s.prog == nil || edge.Pos < 0 {
    return 0, nil
  }
  file := s.prog.SourceFile(from.File)
  if file == nil {
    return 0, nil
  }
  return sourceExcerptAt(file.Text(), edge.Pos, maxLines)
}

func (s *Server) edgeSourceLine(edge *graph.Edge) (int, string) {
  from := s.graph.Nodes[edge.From]
  if from == nil || s.prog == nil || edge.Pos < 0 {
    return 0, ""
  }
  file := s.prog.SourceFile(from.File)
  if file == nil {
    return 0, ""
  }
  text := file.Text()
  if edge.Pos > len(text) {
    return 0, ""
  }
  start := strings.LastIndexByte(text[:edge.Pos], '\n') + 1
  end := strings.IndexByte(text[edge.Pos:], '\n')
  if end < 0 {
    end = len(text)
  } else {
    end += edge.Pos
  }
  return 1 + strings.Count(text[:edge.Pos], "\n"), text[start:end]
}

func sourceExcerptAt(text string, pos int, maxLines int) (int, []string) {
  if pos < 0 || pos > len(text) || maxLines <= 0 {
    return 0, nil
  }
  start := strings.LastIndexByte(text[:pos], '\n') + 1
  line := 1 + strings.Count(text[:pos], "\n")
  rest := strings.Split(text[start:], "\n")
  if len(rest) > maxLines {
    rest = rest[:maxLines]
  }
  for len(rest) > 0 && strings.TrimSpace(rest[len(rest)-1]) == "" {
    rest = rest[:len(rest)-1]
  }
  return line, rest
}

func sourceLineQueryScore(text string, tokens []string) int {
  line := strings.ToLower(text)
  score := 0
  for _, token := range tokens {
    if len(token) < 2 {
      continue
    }
    if strings.Contains(line, token) {
      score += 60
    }
  }
  return score
}

func clipSourceLine(s string, max int) string {
  if len(s) <= max {
    return s
  }
  return s[:max] + "..."
}

func (s *Server) writeFlowSourceWindows(b *strings.Builder, node *graph.Node, included map[string]bool, source string, startLine int, sourceOffset int, query string) {
  lines := strings.Split(source, "\n")
  if len(lines) == 0 {
    return
  }
  tokens := queryTokens(query)
  words := queryWords(query)
  type lineWindow struct {
    start int
    end   int
  }
  windows := make([]lineWindow, 0, maxCallExcerptWindows)
  if codeLine := firstCodeLineIndex(source); codeLine >= 0 {
    end := codeLine
    for end+1 < len(lines) && end-codeLine < 5 && !strings.Contains(lines[end], "{") {
      end++
    }
    windows = append(windows, lineWindow{start: codeLine, end: end})
  }
  type rankedEdge struct {
    edge  *graph.Edge
    score int
    line  int
  }
  edges := make([]rankedEdge, 0)
  for _, edge := range s.graph.Edges {
    if edge.From != node.ID || (edge.Kind != graph.EdgeValueCall && edge.Kind != graph.EdgeValueAccess) {
      continue
    }
    to := s.graph.Nodes[edge.To]
    if to == nil {
      continue
    }
    targetScore := s.pathTargetScoreFrom(node.ID, edge.To, tokens, words)
    onPath := included[edge.To]
    idx := edgeSourceLineIndex(edge, source, sourceOffset)
    if idx < 0 {
      idx = findLateCallLine(lines, 0, memberName(to.Name))
    }
    if idx < 0 {
      continue
    }
    score := targetScore
    if onPath {
      score += 1000
    }
    edges = append(edges, rankedEdge{edge: edge, score: score, line: idx})
  }
  sort.SliceStable(edges, func(i, j int) bool {
    if edges[i].score != edges[j].score {
      return edges[i].score > edges[j].score
    }
    if edges[i].line != edges[j].line {
      return edges[i].line < edges[j].line
    }
    return edges[i].edge.To < edges[j].edge.To
  })
  seen := map[int]bool{}
  for _, ranked := range edges {
    idx := ranked.line
    if seen[idx] {
      continue
    }
    seen[idx] = true
    start := idx
    end := idx + 3
    if end >= len(lines) {
      end = len(lines) - 1
    }
    windows = append(windows, lineWindow{start: start, end: end})
    if len(windows) >= maxCallExcerptWindows {
      break
    }
  }
  if len(windows) <= 1 {
    return
  }
  sort.Slice(windows, func(i, j int) bool {
    if windows[i].start != windows[j].start {
      return windows[i].start < windows[j].start
    }
    return windows[i].end < windows[j].end
  })
  merged := windows[:0]
  for _, window := range windows {
    if len(merged) == 0 || window.start > merged[len(merged)-1].end+1 {
      merged = append(merged, window)
      continue
    }
    if window.end > merged[len(merged)-1].end {
      merged[len(merged)-1].end = window.end
    }
  }
  b.WriteString("  flow source windows:\n")
  written := 0
  last := -1
  for _, window := range merged {
    if window.start > last+1 {
      b.WriteString("  ...\n")
    }
    for i := window.start; i <= window.end; i++ {
      if written >= maxCallExcerptLines {
        b.WriteString("  ... (more flow source omitted)\n")
        return
      }
      fmt.Fprintf(b, "  %d\t%s\n", startLine+i, lines[i])
      written++
      last = i
    }
  }
}

func (s *Server) edgeUseLine(edge *graph.Edge) int {
  from := s.graph.Nodes[edge.From]
  if from == nil || s.prog == nil || edge.Pos < 0 {
    return 0
  }
  file := s.prog.SourceFile(from.File)
  if file == nil {
    return 0
  }
  text := file.Text()
  if edge.Pos > len(text) {
    return 0
  }
  return 1 + strings.Count(text[:edge.Pos], "\n")
}

func (s *Server) writeFlowValueEdges(b *strings.Builder, node *graph.Node, included map[string]bool) {
  for _, edge := range s.graph.Edges {
    if edge.From != node.ID || (edge.Kind != graph.EdgeValueCall && edge.Kind != graph.EdgeValueAccess) || !included[edge.To] {
      continue
    }
    if to := s.graph.Nodes[edge.To]; to != nil {
      label := "->"
      if edge.Kind == graph.EdgeValueAccess {
        label = "~>"
      }
      fmt.Fprintf(b, "  %s %s %s  %s:%d%s\n", label, to.Kind, to.Name, s.relFile(to.File), s.declLine(to), s.edgeUseSuffix(edge))
    }
  }
}

func (s *Server) edgeUseSuffix(edge *graph.Edge) string {
  from := s.graph.Nodes[edge.From]
  if from == nil || edge.Pos < 0 {
    return ""
  }
  file := s.prog.SourceFile(from.File)
  if file == nil {
    return ""
  }
  text := file.Text()
  if edge.Pos > len(text) {
    return ""
  }
  return fmt.Sprintf("  use:%s:%d", s.relFile(from.File), 1+strings.Count(text[:edge.Pos], "\n"))
}

// nodeSource returns the verbatim declaration text of node and its 1-based start
// line, or ("", 0) when the source file is not in the program or the span is out
// of range. Leading whitespace before the declaration is skipped so the slice
// starts at the declaration keyword (or its leading doc comment).
func (s *Server) nodeSource(node *graph.Node) (string, int) {
  source, line, _ := s.nodeSourceRange(node)
  return source, line
}

func (s *Server) nodeSourceRange(node *graph.Node) (string, int, int) {
  file := s.prog.SourceFile(node.File)
  if file == nil {
    return "", 0, 0
  }
  text := file.Text()
  if node.Pos < 0 || node.End > len(text) || node.Pos >= node.End {
    return "", 0, 0
  }
  start := node.Pos
  for start < node.End && isSpace(text[start]) {
    start++
  }
  return text[start:node.End], 1 + strings.Count(text[:start], "\n"), start
}

func isSpace(c byte) bool {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r'
}

// relFile shortens an absolute workspace path to one relative to the project
// root (the server cwd), so a response does not repeat the long absolute prefix
// on every edge. It is pure token waste, since the agent runs from that root. A path
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

// firstCodeOffset returns the index in src of the first non-trivia byte past
// leading whitespace and // line or /* */ block comments, so a signature begins
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

func firstCodeLineIndex(src string) int {
  offset := firstCodeOffset(src)
  if offset >= len(src) {
    return -1
  }
  return strings.Count(src[:offset], "\n")
}

// declLine returns node's 1-based declaration line, skipping the leading doc
// comment that node.Pos carries as trivia so the line points at the declaration
// itself. Carrying this on every edge is what lets a shell-native agent cite a
// call target without re-reading the file to count lines. That was the dominant residual
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
const maxSourceLines = 32

const maxExpandedSourceLines = 180

func expandedSourceLines(nodes int) int {
  switch {
  case nodes <= 3:
    return maxExpandedSourceLines
  case nodes <= 5:
    return 120
  default:
    return 80
  }
}

// maxCallExcerptWindows caps the late-body call windows printed after a
// truncated declaration. These snippets are tied to checker-resolved value-call
// edges, so they preserve code-flow context without dumping the whole body.
const maxCallExcerptWindows = 10

// maxCallExcerptLines caps the merged excerpt lines across all late calls from a
// truncated declaration.
const maxCallExcerptLines = 54

// numberLines prefixes each line of source with its absolute line number so the
// agent can cite or edit by line without re-reading the file, truncating a long
// body to maxSourceLines.
func numberLines(source string, startLine int, limit int) string {
  lines := strings.Split(source, "\n")
  var b strings.Builder
  for i, line := range lines {
    if i >= limit {
      fmt.Fprintf(&b, "  ... (%d more lines)\n", len(lines)-limit)
      break
    }
    fmt.Fprintf(&b, "  %d\t%s\n", startLine+i, line)
  }
  return b.String()
}

func (s *Server) writeValueCallExcerpts(b *strings.Builder, node *graph.Node, source string, startLine int, sourceOffset int, sourceLines int) {
  s.writeValueCallExcerptsRanked(b, node, source, startLine, sourceOffset, sourceLines, nil, nil)
}

func (s *Server) writeValueCallExcerptsForQuery(b *strings.Builder, node *graph.Node, source string, startLine int, sourceOffset int, sourceLines int, query string) {
  s.writeValueCallExcerptsRanked(b, node, source, startLine, sourceOffset, sourceLines, queryTokens(query), queryWords(query))
}

func (s *Server) writeValueCallExcerptsRanked(b *strings.Builder, node *graph.Node, source string, startLine int, sourceOffset int, sourceLines int, tokens []string, words map[string]bool) {
  lines := strings.Split(source, "\n")
  if len(lines) <= sourceLines {
    return
  }
  edges := make([]*graph.Edge, 0)
  for _, edge := range s.graph.Edges {
    if edge.From == node.ID && (edge.Kind == graph.EdgeValueCall || edge.Kind == graph.EdgeValueAccess) {
      edges = append(edges, edge)
    }
  }
  if tokens != nil {
    sort.SliceStable(edges, func(i, j int) bool {
      left := s.pathTargetScoreFrom(node.ID, edges[i].To, tokens, words)
      right := s.pathTargetScoreFrom(node.ID, edges[j].To, tokens, words)
      if left != right {
        return left > right
      }
      return edges[i].To < edges[j].To
    })
  }
  type lineWindow struct {
    start int
    end   int
  }
  windows := make([]lineWindow, 0, maxCallExcerptWindows)
  seen := map[int]bool{}
  for _, edge := range edges {
    to := s.graph.Nodes[edge.To]
    if to == nil {
      continue
    }
    idx := edgeLineIndex(edge, source, sourceOffset, sourceLines)
    if idx < 0 {
      idx = findLateCallLine(lines, sourceLines, memberName(to.Name))
    }
    if idx < 0 || seen[idx] {
      continue
    }
    seen[idx] = true
    start := idx - 2
    if start < sourceLines {
      start = sourceLines
    }
    end := idx + 5
    if end >= len(lines) {
      end = len(lines) - 1
    }
    windows = append(windows, lineWindow{start: start, end: end})
    if len(windows) >= maxCallExcerptWindows {
      break
    }
  }
  if len(windows) == 0 {
    return
  }
  sort.Slice(windows, func(i, j int) bool {
    if windows[i].start != windows[j].start {
      return windows[i].start < windows[j].start
    }
    return windows[i].end < windows[j].end
  })
  merged := windows[:0]
  for _, window := range windows {
    if len(merged) == 0 || window.start > merged[len(merged)-1].end+1 {
      merged = append(merged, window)
      continue
    }
    if window.end > merged[len(merged)-1].end {
      merged[len(merged)-1].end = window.end
    }
  }
  b.WriteString("  value-use excerpts after truncated body:\n")
  written := 0
  last := sourceLines - 1
  for _, window := range merged {
    if window.start > last+1 {
      b.WriteString("  ...\n")
    }
    for i := window.start; i <= window.end; i++ {
      if written >= maxCallExcerptLines {
        b.WriteString("  ... (more value-use excerpts omitted)\n")
        return
      }
      fmt.Fprintf(b, "  %d\t%s\n", startLine+i, lines[i])
      written++
      last = i
    }
  }
  if len(windows) >= maxCallExcerptWindows {
    b.WriteString("  ... (more value-use excerpts omitted)\n")
  }
}

func memberName(name string) string {
  if dot := strings.LastIndexByte(name, '.'); dot >= 0 {
    return name[dot+1:]
  }
  return name
}

func edgeLineIndex(edge *graph.Edge, source string, sourceOffset int, sourceLines int) int {
  idx := edgeSourceLineIndex(edge, source, sourceOffset)
  if idx < sourceLines {
    return -1
  }
  return idx
}

func edgeSourceLineIndex(edge *graph.Edge, source string, sourceOffset int) int {
  if edge.Pos < sourceOffset || edge.Pos >= sourceOffset+len(source) {
    return -1
  }
  return strings.Count(source[:edge.Pos-sourceOffset], "\n")
}

func findLateCallLine(lines []string, startLine int, member string) int {
  if member == "" {
    return -1
  }
  for i := startLine; i < len(lines); i++ {
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
// exploring the class shows that its members are broken. The fix-safety signal
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
func (s *Server) queryDiagnostics(args json.RawMessage) (any, *rpcError) {
  var in struct {
    Files    []string `json:"files"`
    Severity string   `json:"severity"`
  }
  if err := json.Unmarshal(args, &in); err != nil {
    return nil, &rpcError{Code: codeInvalidParams, Message: "query_diagnostics: invalid arguments"}
  }
  sev := strings.ToLower(strings.TrimSpace(in.Severity))
  if sev == "" {
    sev = "error"
  }
  if sev != "error" && sev != "warning" && sev != "all" {
    return nil, &rpcError{Code: codeInvalidParams, Message: `query_diagnostics 'severity' must be "error", "warning", "all", or omitted`}
  }
  if err := s.ensureLoaded(); err != nil {
    return nil, &rpcError{Code: codeInternal, Message: "graph not available: " + err.Error()}
  }
  s.refreshIfStale()
  s.refreshDiagnostics()
  locations := make([]string, 0, len(in.Files))
  for _, f := range in.Files {
    if strings.TrimSpace(f) != "" {
      locations = append(locations, f)
    }
  }
  // No files: the whole-project listing, one block.
  if len(locations) == 0 {
    return s.projectDiagnostics(sev), nil
  }
  // One block per requested file, in input order.
  blocks := make([]string, 0, len(locations))
  for _, loc := range locations {
    blocks = append(blocks, s.fileDiagnosticsBlock(loc, sev))
  }
  return textBlocks(blocks), nil
}

// fileDiagnosticsBlock renders one file's diagnostics as a text block headed with
// the requested location, applying the severity filter. It reports a no-match or
// ambiguous-fragment hint instead of failing, so one bad path in a batch does not
// sink the others.
func (s *Server) fileDiagnosticsBlock(loc, sev string) string {
  var b strings.Builder
  fmt.Fprintf(&b, "## %s\n", loc)
  matches := s.resolveFile(loc)
  switch len(matches) {
  case 0:
    fmt.Fprintf(&b, "No project source file matches %q.", loc)
    return b.String()
  case 1:
  default:
    fmt.Fprintf(&b, "%q matches %d files; pass a longer path fragment to disambiguate:\n", loc, len(matches))
    for _, m := range matches {
      fmt.Fprintf(&b, "  %s\n", s.relFile(m))
    }
    return strings.TrimRight(b.String(), "\n")
  }
  path := matches[0]
  found := make([]fusedDiagnostic, 0)
  for _, d := range s.diags {
    if d.File == path && severityMatches(d, sev) {
      found = append(found, d)
    }
  }
  relPath := s.relFile(path)
  if len(found) == 0 {
    fmt.Fprintf(&b, "No %sdiagnostics for %s.", severityLabel(sev), relPath)
    return b.String()
  }
  sortDiagnostics(found)
  for _, d := range found {
    if d.fromTsc {
      fmt.Fprintf(&b, "%s:%d:%d TS%d %s\n", relPath, d.Line, d.Column, d.Code, d.Message)
    } else {
      fmt.Fprintf(&b, "%s:%d:%d %s\n", relPath, d.Line, d.Column, d.Message)
    }
  }
  return strings.TrimRight(b.String(), "\n")
}

// maxProjectDiagnostics caps the whole-project listing so a badly broken project
// cannot flood the agent's context; the remainder is summarized as a count with
// a pointer to query a single file for the rest.
const maxProjectDiagnostics = 100

// projectDiagnostics lists every current diagnostic across the project, grouped
// by file and ordered by path, for the agent's "what is broken now" check after
// an edit. It reads the same fused set as the single-file path (tsc + injected
// lint / transform findings) and caps the output at maxProjectDiagnostics.
func (s *Server) projectDiagnostics(sev string) any {
  byFile := make(map[string][]fusedDiagnostic)
  total := 0
  for _, d := range s.diags {
    if !severityMatches(d, sev) {
      continue
    }
    byFile[d.File] = append(byFile[d.File], d)
    total++
  }
  if total == 0 {
    return textResult(fmt.Sprintf("No %sdiagnostics in the project.", severityLabel(sev)))
  }
  files := make([]string, 0, len(byFile))
  for f := range byFile {
    files = append(files, f)
  }
  sort.Strings(files)

  var b strings.Builder
  fmt.Fprintf(&b, "%d diagnostic(s) across %d file(s):\n", total, len(files))
  shown := 0
  for _, f := range files {
    if shown >= maxProjectDiagnostics {
      break
    }
    found := byFile[f]
    sortDiagnostics(found)
    fmt.Fprintf(&b, "\n%s:\n", s.relFile(f))
    for _, d := range found {
      if shown >= maxProjectDiagnostics {
        break
      }
      if d.fromTsc {
        fmt.Fprintf(&b, "  %d:%d TS%d %s\n", d.Line, d.Column, d.Code, d.Message)
      } else {
        fmt.Fprintf(&b, "  %d:%d %s\n", d.Line, d.Column, d.Message)
      }
      shown++
    }
  }
  if shown < total {
    fmt.Fprintf(&b, "\n... +%d more; query a specific file for the rest.\n", total-shown)
  }
  return textResult(strings.TrimRight(b.String(), "\n"))
}

// severityMatches reports whether d satisfies the requested filter: "error" keeps
// errors, "warning" keeps warnings, and "" (the default) keeps both.
func severityMatches(d fusedDiagnostic, want string) bool {
  switch want {
  case "error":
    return d.IsError()
  case "warning":
    return !d.IsError()
  default:
    return true
  }
}

// severityLabel renders the filter for a "No <label>diagnostics" message, with a
// trailing space, or "" for the unfiltered ("all") case so the sentence reads
// naturally.
func severityLabel(want string) string {
  if want == "" || want == "all" {
    return ""
  }
  return want + " "
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
  // Otherwise a Windows-style "src\main.ts" never matches ".../src/main.ts".
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
