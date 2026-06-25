// Package mcp serves the checker-resolved code graph to coding agents over the
// Model Context Protocol (JSON-RPC 2.0 on stdio). The server holds one resident
// Program and answers every tool call from that warm handle, so a query is a
// method call on an already-built checker, not an external language-server
// round-trip. Before answering, it folds in any on-disk edits incrementally
// (UpdateProgram re-checks only changed files), so the graph follows the source
// instead of freezing at startup, without paying a full recompile per call.
//
// Guidance is delivered only in the `initialize` response (serverInstructions);
// the server never writes into the user's CLAUDE.md / AGENTS.md, so install is
// side-effect-free and the guidance stays versioned with the binary.
package mcp

import (
  _ "embed"
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "strings"
  "sync"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// Version is the server version reported in the initialize response. main
// overrides it from build metadata.
var Version = "0.0.0-dev"

// DiagnosticProvider contributes diagnostics beyond the tsc semantic pass,
// computed over the same resident Program. It is the seam through which a
// plugin-aware host injects @ttsc/lint findings and transform-plugin
// diagnostics: the prebuilt ttscgraph registers none and stays tsc-only, while
// a host built with the project's plugins linked supplies them, and the graph
// fuses every source onto its nodes identically. A provider runs once, with the
// graph, on a read-only Program.
type DiagnosticProvider func(*driver.Program) []driver.Diagnostic

// fusedDiagnostic is a diagnostic tagged with its origin. The origin is tracked
// explicitly rather than inferred from the code, because a TypeScript code is
// NOT bounded below @ttsc/lint's hash band: the strict-null family (TS18046+) is
// >= 9000, so a numeric split would strip the "TS" from a real compiler error.
type fusedDiagnostic struct {
  driver.Diagnostic
  fromTsc bool
}

// defaultProtocolVersion is echoed when a client does not announce one.
const defaultProtocolVersion = "2025-06-18"

// serverInstructions is the guidance shipped in the initialize response, the only
// channel through which the server advises an agent (nothing is written to disk).
// It is embedded from instructions.md at build time, so the prompt is authored and
// reviewed as Markdown yet travels inside the binary with no runtime file load.
//
//go:embed instructions.md
var serverInstructions string

// Server answers MCP requests from a resident Program and the graph built from
// it. The Program/graph may be supplied eagerly or built in the background; ready
// is closed once the build (or its failure) lands.
type Server struct {
  cwd      string
  tsconfig string
  options  driver.LoadProgramOptions
  ready    chan struct{}
  // session keeps the program resident over an overlay FS so an on-disk edit is
  // folded in with an incremental UpdateProgram (re-checking only the changed
  // files) instead of a full recompile. nil for an in-process Program supplied
  // to NewServer, which does not track on-disk staleness.
  session *driver.Session
  prog    *driver.Program
  graph   *graph.Graph
  degree  map[string]int
  // reverseAdj maps a node to the nodes that depend on it (the reverse of every
  // edge), so the blast-radius walk is O(V+E) instead of rescanning all edges
  // per step.
  reverseAdj map[string][]string
  // forwardCallAdj maps a node to the nodes it calls (the forward of every
  // value-call edge), so a flow query can walk the downstream call path in one
  // pass instead of the agent re-querying each hop.
  forwardCallAdj map[string][]string
  // reverseValueAdj maps a value target to declarations that read/call it. Flow
  // uses this to surface relevant consumers, e.g. a state store to the summary
  // method that later consumes it.
  reverseValueAdj map[string][]string
  // implementorsAdj maps an interface or base to the declarations that implement
  // or extend it (the reverse of every heritage edge), so the call path can cross
  // the dynamic-dispatch seam from an interface method to its concrete body,
  // which value-call edges stop at.
  implementorsAdj map[string][]string
  // tscDiags is the compiler's own diagnostics, computed once with the graph
  // (the Program is read-only after build). diags is the fused set — tscDiags
  // plus every provider's current output — and diagsByNode attributes each to the
  // declaration it occurs in, so graph_explore can fuse the live "what is broken"
  // view onto the static structure it already serves. The fused set is refreshed
  // per query so a file-backed provider (the launcher's plugin diagnostics,
  // computed in the background) is picked up once it lands.
  tscDiags    []driver.Diagnostic
  diags       []fusedDiagnostic
  diagsByNode map[string][]fusedDiagnostic
  // nodeLineRanges is each node's 1-based [startLine, endLine], so a diagnostic
  // that carries only a line — a plugin/lint finding parsed from ttsc's text
  // banner, which has no byte offset — can still be attributed to its declaration.
  nodeLineRanges map[string][2]int
  // diagProviders contribute non-tsc diagnostics (lint, transform plugins) over
  // the same Program; empty for the prebuilt binary, populated by a plugin-aware
  // host. Set once at construction, read only inside setProgram.
  diagProviders []DiagnosticProvider
  loadErr       error
  // srcFiles are the project's own on-disk source paths (compiler libs and
  // node_modules excluded), captured at each build; srcMTime is the newest
  // modification time among them at that build. A tool call re-stats srcFiles
  // and rebuilds when anything is newer, so the graph follows source edits
  // instead of serving a snapshot frozen at startup. Only the lazy (cwd/tsconfig)
  // construction can reload; an in-process Program leaves both empty.
  srcFiles []string
  srcMTime time.Time
  // ignored is the set of graph source files git ignores (generated output like
  // a Prisma client or other codegen emitted as .ts). The matcher de-surfaces
  // them so they do not dominate ranking; they stay reachable as edge targets
  // and by exact name. Recomputed with the graph on each (re)build.
  ignored map[string]bool
  // mu serializes tool calls so one Server can back many daemon connections
  // safely (the graph is read-only after build, but the checker behind
  // graph_diagnostics is not concurrency-safe).
  mu sync.Mutex
}

// NewServer builds the resident graph from an already-open Program immediately.
// Used in-process and by tests, where the Program is on hand. Optional
// diagnostic providers contribute lint / transform-plugin findings to the fused
// graph.
func NewServer(prog *driver.Program, providers ...DiagnosticProvider) *Server {
  s := &Server{ready: make(chan struct{}), diagProviders: providers}
  s.setProgram(prog)
  close(s.ready)
  return s
}

// NewLazyServer answers the MCP handshake immediately and builds the resident
// Program and graph in the background, so initialize/tools-list do not wait on a
// large project's type-check. The first tool call blocks until the build lands
// (usually already done by the time an agent queries). This is the cold-start
// fix: an eager build before the handshake leaves the server "pending" with no
// tools advertised, and an agent falls back to reading files.
func NewLazyServer(cwd, tsconfig string, options driver.LoadProgramOptions, providers ...DiagnosticProvider) *Server {
  s := &Server{cwd: cwd, tsconfig: tsconfig, options: options, ready: make(chan struct{}), diagProviders: providers}
  go s.load()
  return s
}

func (s *Server) load() {
  defer close(s.ready)
  session, _, err := driver.NewSession(s.cwd, s.tsconfig, s.options)
  if err != nil {
    s.loadErr = err
    return
  }
  if session == nil || session.Program() == nil {
    s.loadErr = fmt.Errorf("could not load project %q", s.tsconfig)
    return
  }
  s.session = session
  s.setProgram(session.Program())
}

// ensureLoaded blocks until the resident graph is built, returning any load error.
func (s *Server) ensureLoaded() error {
  <-s.ready
  return s.loadErr
}

// setProgram builds the graph and a node-degree index (used to rank keyword
// matches by centrality) from prog.
func (s *Server) setProgram(prog *driver.Program) {
  s.prog = prog
  s.graph = graph.Build(prog)
  s.degree = make(map[string]int, len(s.graph.Nodes))
  s.reverseAdj = make(map[string][]string, len(s.graph.Nodes))
  s.forwardCallAdj = make(map[string][]string)
  s.reverseValueAdj = make(map[string][]string)
  s.implementorsAdj = make(map[string][]string)
  for _, edge := range s.graph.Edges {
    s.degree[edge.From]++
    s.degree[edge.To]++
    s.reverseAdj[edge.To] = append(s.reverseAdj[edge.To], edge.From)
    switch edge.Kind {
    case graph.EdgeValueCall, graph.EdgeValueAccess:
      s.forwardCallAdj[edge.From] = append(s.forwardCallAdj[edge.From], edge.To)
      s.reverseValueAdj[edge.To] = append(s.reverseValueAdj[edge.To], edge.From)
    case graph.EdgeHeritage:
      s.implementorsAdj[edge.To] = append(s.implementorsAdj[edge.To], edge.From)
    }
  }
  s.tscDiags = prog.Diagnostics()
  s.nodeLineRanges = computeNodeLineRanges(prog, s.graph)
  s.refreshDiagnostics()
  s.srcFiles = s.projectSourceFiles()
  s.srcMTime, _ = newestMTime(s.srcFiles)
  // De-surface git-ignored generated code (a Prisma client, other codegen
  // emitted as .ts) so it does not dominate ranking. graph.GitIgnoredFiles is
  // the shared detector the full-graph dump uses too. They stay in the program
  // for type resolution and remain reachable as edge targets and by exact name.
  s.ignored = graph.GitIgnoredFiles(s.cwd, s.graph)
}

// projectSourceFiles returns the absolute on-disk paths of the project's own
// source files referenced by the graph, skipping the compiler's bundled libs
// and dependency files (node_modules). It returns nil for an in-process Program
// with no cwd, where on-disk staleness tracking does not apply.
func (s *Server) projectSourceFiles() []string {
  if s.cwd == "" {
    return nil
  }
  seen := make(map[string]bool)
  var files []string
  for _, node := range s.graph.Nodes {
    f := node.File
    if f == "" || strings.HasPrefix(f, "bundled:///") || strings.Contains(f, "node_modules") {
      continue
    }
    if !filepath.IsAbs(f) {
      f = filepath.Join(s.cwd, f)
    }
    if seen[f] {
      continue
    }
    seen[f] = true
    files = append(files, f)
  }
  return files
}

// newestMTime returns the newest modification time among files and whether any
// is missing (a deletion, which also counts as a change).
func newestMTime(files []string) (time.Time, bool) {
  var newest time.Time
  missing := false
  for _, f := range files {
    info, err := os.Stat(f)
    if err != nil {
      missing = true
      continue
    }
    if mt := info.ModTime(); mt.After(newest) {
      newest = mt
    }
  }
  return newest, missing
}

// refreshIfStale brings the resident graph up to date with on-disk edits before
// a tool call answers, so the graph follows the source instead of serving a
// snapshot frozen at startup. A cheap stat of the known source files gates the
// work: when nothing changed the cached graph is served untouched. When files
// changed it re-feeds only those through the incremental Session (UpdateProgram
// reuses the unchanged ASTs and checker, re-checking just the edited files) and
// rebuilds the graph from the updated program. A structural change a content
// edit cannot express (a deleted file) falls back to a fresh Session. A
// transient failure keeps the last good graph. The caller must hold s.mu; an
// in-process Program with no Session is left as is.
func (s *Server) refreshIfStale() {
  if s.session == nil || len(s.srcFiles) == 0 {
    return
  }
  changed := s.changedFiles()
  if len(changed) == 0 {
    return
  }
  rebuilt := false
  for _, f := range changed {
    content, err := os.ReadFile(f)
    if err != nil {
      rebuilt = true // a deletion reshapes the project beyond a content edit
      break
    }
    s.session.Apply(f, string(content))
  }
  if rebuilt {
    session, _, err := driver.NewSession(s.cwd, s.tsconfig, s.options)
    if err != nil || session == nil || session.Program() == nil {
      return
    }
    s.session = session
  }
  s.setProgram(s.session.Program())
}

// changedFiles re-stats the known project source files and returns those whose
// modification time is newer than the last build, or that have gone missing.
func (s *Server) changedFiles() []string {
  var changed []string
  for _, f := range s.srcFiles {
    info, err := os.Stat(f)
    if err != nil {
      changed = append(changed, f)
      continue
    }
    if info.ModTime().After(s.srcMTime) {
      changed = append(changed, f)
    }
  }
  return changed
}

// refreshDiagnostics recomputes the fused diagnostic set and re-attributes it
// onto the graph. When a provider supplies diagnostics they are authoritative:
// the launcher's worker runs ttsc's own check, so its output is the complete
// plugin-aware set (the compiler's type errors plus @ttsc/lint and transform-
// plugin findings) and replaces the server's tsc-only pass — no de-duplication
// needed. With no provider output, the resident Program's diagnostics are used.
// Providers are re-run per query so a file-backed provider whose contents arrive
// after startup is picked up without restarting. Callers hold the tool-call
// lock, so this runs serially with the queries that read the result.
func (s *Server) refreshDiagnostics() {
  // The compiler's own diagnostics are always present and authoritative for type
  // errors — they must never be dropped. (A provider's check can return its lint
  // findings ALONE: @ttsc/lint exits non-zero on an error, which short-circuits
  // ttsc's check before the semantic pass, so the injected set is not a superset
  // of the type errors. Replacing here would make real type errors vanish.)
  fused := make([]fusedDiagnostic, 0, len(s.tscDiags))
  seen := make(map[string]struct{}, len(s.tscDiags))
  for _, d := range s.tscDiags {
    fused = append(fused, fusedDiagnostic{Diagnostic: d, fromTsc: true})
    seen[diagKey(d)] = struct{}{}
  }
  // Merge the providers' findings (lint, transform plugins), skipping any that
  // duplicate a tsc diagnostic — so a provider that returns the full set (tsc +
  // lint) does not double-list the type errors, and one that returns lint alone
  // simply adds them.
  for _, provide := range s.diagProviders {
    if provide == nil {
      continue
    }
    for _, d := range provide(s.prog) {
      if _, dup := seen[diagKey(d)]; dup {
        continue
      }
      seen[diagKey(d)] = struct{}{}
      fused = append(fused, fusedDiagnostic{Diagnostic: d, fromTsc: false})
    }
  }
  s.diags = fused
  s.diagsByNode = attributeDiagnostics(s.graph, s.nodeLineRanges, fused)
}

// diagKey identifies a diagnostic by file, code, and full position, the key the
// merge uses to drop an injected duplicate of a tsc diagnostic. The column is
// part of the key so two distinct findings on the same line with the same code —
// reachable when string-coded plugin findings all carry the fallback code — are
// not collapsed into one.
func diagKey(d driver.Diagnostic) string {
  return fmt.Sprintf("%s\x00%d\x00%d\x00%d", d.File, d.Code, d.Line, d.Column)
}

// attributeDiagnostics maps each diagnostic to the smallest graph node that
// contains it, so a finding lands on the declaration it occurs in and
// graph_explore can show "this symbol is broken here" alongside its edges. A
// diagnostic with a byte offset (the compiler's own pass) is placed by span; one
// with only a line (a plugin finding parsed from ttsc's text banner) is placed
// by line range. A finding that falls between declarations (a top-of-file import
// error) stays unattributed rather than smeared onto a neighbor.
func attributeDiagnostics(g *graph.Graph, lineRanges map[string][2]int, diags []fusedDiagnostic) map[string][]fusedDiagnostic {
  byNode := make(map[string][]fusedDiagnostic)
  for _, d := range diags {
    if d.File == "" {
      continue
    }
    var best *graph.Node
    bestSize := 0
    for _, node := range g.Nodes {
      if node.File != d.File {
        continue
      }
      contains, size := false, 0
      if d.Start != nil {
        pos := *d.Start
        contains = pos >= node.Pos && pos < node.End
        size = node.End - node.Pos
      } else if d.Line > 0 {
        if lr, ok := lineRanges[node.ID]; ok {
          contains = d.Line >= lr[0] && d.Line <= lr[1]
          size = lr[1] - lr[0]
        }
      }
      if !contains {
        continue
      }
      // Smallest containing node wins; ties (two declarations sharing a line,
      // reachable only on the line-only path) break on a stable key so the
      // attribution is deterministic across Go's randomized map iteration.
      if best == nil || size < bestSize || (size == bestSize && node.ID < best.ID) {
        best, bestSize = node, size
      }
    }
    if best != nil {
      byNode[best.ID] = append(byNode[best.ID], d)
    }
  }
  return byNode
}

// computeNodeLineRanges records each node's 1-based [startLine, endLine] from its
// source file's text, the index a line-only diagnostic is attributed against.
func computeNodeLineRanges(prog *driver.Program, g *graph.Graph) map[string][2]int {
  out := make(map[string][2]int, len(g.Nodes))
  texts := map[string]string{}
  for _, node := range g.Nodes {
    text, ok := texts[node.File]
    if !ok {
      if file := prog.SourceFile(node.File); file != nil {
        text = file.Text()
      }
      texts[node.File] = text
    }
    if text == "" || node.Pos < 0 || node.End > len(text) || node.Pos > node.End {
      continue
    }
    start := 1 + strings.Count(text[:node.Pos], "\n")
    end := 1 + strings.Count(text[:node.End], "\n")
    out[node.ID] = [2]int{start, end}
  }
  return out
}

type request struct {
  JSONRPC string          `json:"jsonrpc"`
  ID      json.RawMessage `json:"id,omitempty"`
  Method  string          `json:"method"`
  Params  json.RawMessage `json:"params,omitempty"`
}

// response is one JSON-RPC 2.0 reply. Its MarshalJSON enforces the spec
// invariant that a reply carries exactly one of result | error: a success reply
// always includes result (even a falsy one, which `omitempty` would wrongly
// drop), and an error reply never includes result.
type response struct {
  ID     json.RawMessage
  Result any
  Error  *rpcError
}

func (r response) MarshalJSON() ([]byte, error) {
  wire := map[string]any{"jsonrpc": "2.0", "id": r.ID}
  if r.Error != nil {
    wire["error"] = r.Error
  } else {
    wire["result"] = r.Result
  }
  return json.Marshal(wire)
}

type rpcError struct {
  Code    int    `json:"code"`
  Message string `json:"message"`
}

// JSON-RPC 2.0 error codes used here (a subset of the spec).
const (
  codeParseError     = -32700
  codeMethodNotFound = -32601
  codeInvalidParams  = -32602
  codeInternal       = -32603
)

// Handle dispatches one JSON-RPC message and returns the response bytes to write.
// It returns (nil, false) only for a notification (a well-formed request with no
// id), which warrants no reply; malformed JSON is answered with a null-id parse
// error so a client awaiting a reply does not hang.
func (s *Server) Handle(raw []byte) ([]byte, bool) {
  var req request
  if err := json.Unmarshal(raw, &req); err != nil {
    // The id is unrecoverable from unparseable input, so reply with a null id
    // per JSON-RPC 2.0 §4.2 rather than going silent.
    return reply(response{ID: json.RawMessage("null"), Error: &rpcError{Code: codeParseError, Message: "parse error"}})
  }
  if len(req.ID) == 0 {
    return nil, false
  }
  resp := response{ID: req.ID}
  switch req.Method {
  case "initialize":
    resp.Result = initializeResult(req.Params)
  case "tools/list":
    resp.Result = toolsListResult()
  case "tools/call":
    s.mu.Lock()
    result, rpcErr := s.callTool(req.Params)
    s.mu.Unlock()
    if rpcErr != nil {
      resp.Error = rpcErr
    } else {
      resp.Result = result
    }
  default:
    resp.Error = &rpcError{Code: codeMethodNotFound, Message: "method not found: " + clip(req.Method, 80)}
  }
  return reply(resp)
}

// reply marshals a response for the transport. The controlled result/error
// shapes here always marshal, so the (nil,false) path is defensive only.
func reply(resp response) ([]byte, bool) {
  out, err := json.Marshal(resp)
  if err != nil {
    return nil, false
  }
  return out, true
}

// initializeResult echoes the client's protocol version when it announces one,
// advertises the tools capability, and ships the usage guidance.
func initializeResult(params json.RawMessage) any {
  version := defaultProtocolVersion
  if len(params) > 0 {
    var in struct {
      ProtocolVersion string `json:"protocolVersion"`
    }
    if err := json.Unmarshal(params, &in); err == nil && in.ProtocolVersion != "" {
      version = in.ProtocolVersion
    }
  }
  return map[string]any{
    "protocolVersion": version,
    "capabilities":    map[string]any{"tools": map[string]any{}},
    "serverInfo":      map[string]any{"name": "ttsc-graph", "version": Version},
    "instructions":    serverInstructions,
  }
}
