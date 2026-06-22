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
  "sync"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// Version is the server version reported in the initialize response. main
// overrides it from build metadata.
var Version = "0.0.0-dev"

// defaultProtocolVersion is echoed when a client does not announce one.
const defaultProtocolVersion = "2025-06-18"

// serverInstructions is shipped in the initialize response. It is the only
// channel through which the server advises an agent; nothing is written to disk.
const serverInstructions = "ttsc-graph is a checker-resolved code graph of this TypeScript project, " +
  "pre-walked by the real type checker. Start ANY question about how the code works (a flow, an " +
  "architecture, what calls or relates to a symbol, a blast radius, where something lives) by calling " +
  "graph_explore with the key term(s): a symbol name, OR the salient nouns of the question (for " +
  "\"how does it render and update canvas elements\", query \"render update canvas element\"). It " +
  "ranks the matching declarations and returns, for each, the verbatim source, the exact incoming " +
  "and outgoing edges, and the transitive-dependent count, so you can trace the design without " +
  "grepping or opening files; answer from it and only read a file for detail it does not cover. Use " +
  "graph_diagnostics for a file's type errors. Edges are type-resolved (barrel re-exports and " +
  "cross-package references are followed to the real declaration); a node_modules or .d.ts target is " +
  "an external leaf the graph does not walk into."

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
  loadErr  error
  // mu serializes tool calls so one Server can back many daemon connections
  // safely (the graph is read-only after build, but the checker behind
  // graph_diagnostics is not concurrency-safe).
  mu sync.Mutex
}

// NewServer builds the resident graph from an already-open Program immediately.
// Used in-process and by tests, where the Program is on hand.
func NewServer(prog *driver.Program) *Server {
  s := &Server{ready: make(chan struct{})}
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
func NewLazyServer(cwd, tsconfig string, options driver.LoadProgramOptions) *Server {
  s := &Server{cwd: cwd, tsconfig: tsconfig, options: options, ready: make(chan struct{})}
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
  for _, edge := range s.graph.Edges {
    s.degree[edge.From]++
    s.degree[edge.To]++
  }
}

type request struct {
  JSONRPC string          `json:"jsonrpc"`
  ID      json.RawMessage `json:"id,omitempty"`
  Method  string          `json:"method"`
  Params  json.RawMessage `json:"params,omitempty"`
}

type response struct {
  JSONRPC string          `json:"jsonrpc"`
  ID      json.RawMessage `json:"id"`
  Result  any             `json:"result,omitempty"`
  Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
  Code    int    `json:"code"`
  Message string `json:"message"`
}

// JSON-RPC error codes used here (a subset of the spec).
const (
  codeMethodNotFound = -32601
  codeInvalidParams  = -32602
  codeInternal       = -32603
)

// Handle dispatches one JSON-RPC message and returns the response bytes to write.
// It returns (nil, false) for a notification (no id) or input it cannot parse,
// since neither warrants a reply on the stdio stream.
func (s *Server) Handle(raw []byte) ([]byte, bool) {
  var req request
  if err := json.Unmarshal(raw, &req); err != nil {
    return nil, false
  }
  if len(req.ID) == 0 {
    return nil, false
  }
  resp := response{JSONRPC: "2.0", ID: req.ID}
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
