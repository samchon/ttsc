// Package mcp serves the checker-resolved code graph to coding agents over the
// Model Context Protocol (JSON-RPC 2.0 on stdio). The server holds one resident
// Program: it builds the graph once at startup and answers every tool call from
// that warm handle, so a query is a method call on an already-built checker, not
// a fresh compile and not an external language-server round-trip.
//
// Guidance is delivered only in the `initialize` response (serverInstructions);
// the server never writes into the user's CLAUDE.md / AGENTS.md, so install is
// side-effect-free and the guidance stays versioned with the binary.
package mcp

import (
  "encoding/json"
  "fmt"
  "strings"
  "sync"

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

// defaultProtocolVersion is echoed when a client does not announce one.
const defaultProtocolVersion = "2025-06-18"

// serverInstructions is shipped in the initialize response. It is the only
// channel through which the server advises an agent; nothing is written to disk.
const serverInstructions = "ttsc-graph is this project's checker-resolved code graph: its nodes are the " +
  "declarations and their methods, and its edges (calls, type references, heritage) are the TypeScript " +
  "compiler's own resolution — every relationship, down to a method-to-method or constructor call, that " +
  "you would otherwise grep for is already an edge. For any question about how the code works, call " +
  "graph_explore first (a symbol name, or the salient nouns of the question, e.g. \"render update canvas " +
  "element\") and answer from it; trust the resolved edges rather than re-reading. Open a file only for " +
  "statement-level detail inside a body it summarizes. graph_explore also shows a symbol's own diagnostics " +
  "and how much of its blast radius is already broken, so you can judge a change's safety before making it. " +
  "Use graph_diagnostics for one file's errors: TypeScript type errors plus the project's @ttsc/lint and " +
  "transform-plugin findings."

// Server answers MCP requests from a resident Program and the graph built from
// it. The Program/graph may be supplied eagerly or built in the background; ready
// is closed once the build (or its failure) lands.
type Server struct {
  cwd      string
  tsconfig string
  options  driver.LoadProgramOptions
  ready    chan struct{}
  prog     *driver.Program
  graph    *graph.Graph
  degree   map[string]int
  // reverseAdj maps a node to the nodes that depend on it (the reverse of every
  // edge), so the blast-radius walk is O(V+E) instead of rescanning all edges
  // per step.
  reverseAdj map[string][]string
  // tscDiags is the compiler's own diagnostics, computed once with the graph
  // (the Program is read-only after build). diags is the fused set — tscDiags
  // plus every provider's current output — and diagsByNode attributes each to the
  // declaration it occurs in, so graph_explore can fuse the live "what is broken"
  // view onto the static structure it already serves. The fused set is refreshed
  // per query so a file-backed provider (the launcher's plugin diagnostics,
  // computed in the background) is picked up once it lands.
  tscDiags    []driver.Diagnostic
  diags       []driver.Diagnostic
  diagsByNode map[string][]driver.Diagnostic
  // nodeLineRanges is each node's 1-based [startLine, endLine], so a diagnostic
  // that carries only a line — a plugin/lint finding parsed from ttsc's text
  // banner, which has no byte offset — can still be attributed to its declaration.
  nodeLineRanges map[string][2]int
  // diagProviders contribute non-tsc diagnostics (lint, transform plugins) over
  // the same Program; empty for the prebuilt binary, populated by a plugin-aware
  // host. Set once at construction, read only inside setProgram.
  diagProviders []DiagnosticProvider
  loadErr       error
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
  prog, _, err := driver.LoadProgram(s.cwd, s.tsconfig, s.options)
  if err != nil {
    s.loadErr = err
    return
  }
  if prog == nil {
    s.loadErr = fmt.Errorf("could not load project %q", s.tsconfig)
    return
  }
  s.setProgram(prog)
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
  for _, edge := range s.graph.Edges {
    s.degree[edge.From]++
    s.degree[edge.To]++
    s.reverseAdj[edge.To] = append(s.reverseAdj[edge.To], edge.From)
  }
  s.tscDiags = prog.Diagnostics()
  s.nodeLineRanges = computeNodeLineRanges(prog, s.graph)
  s.refreshDiagnostics()
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
  var injected []driver.Diagnostic
  for _, provide := range s.diagProviders {
    if provide != nil {
      injected = append(injected, provide(s.prog)...)
    }
  }
  if len(injected) > 0 {
    s.diags = injected
  } else {
    s.diags = s.tscDiags
  }
  s.diagsByNode = attributeDiagnostics(s.graph, s.nodeLineRanges, s.diags)
}

// attributeDiagnostics maps each diagnostic to the smallest graph node that
// contains it, so a finding lands on the declaration it occurs in and
// graph_explore can show "this symbol is broken here" alongside its edges. A
// diagnostic with a byte offset (the compiler's own pass) is placed by span; one
// with only a line (a plugin finding parsed from ttsc's text banner) is placed
// by line range. A finding that falls between declarations (a top-of-file import
// error) stays unattributed rather than smeared onto a neighbor.
func attributeDiagnostics(g *graph.Graph, lineRanges map[string][2]int, diags []driver.Diagnostic) map[string][]driver.Diagnostic {
  byNode := make(map[string][]driver.Diagnostic)
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
      if contains && (best == nil || size < bestSize) {
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
    resp.Error = &rpcError{Code: codeMethodNotFound, Message: "method not found: " + req.Method}
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
