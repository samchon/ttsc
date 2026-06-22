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
const serverInstructions = "ttsc-graph is this project's checker-resolved code graph: its nodes are the " +
  "top-level declarations and its edges (calls, type references, heritage) are the TypeScript compiler's " +
  "own resolution, not a textual guess. For an architecture or flow question — how the pieces fit, what " +
  "relates to a symbol, a blast radius — call graph_explore first (a symbol name, or the salient nouns of " +
  "the question, e.g. \"render update canvas element\") and answer from it: the top-level structure it " +
  "returns is usually the whole answer, so you need not grep. Open a file only when the question turns on " +
  "logic inside a method or a variable-bound callable, which the graph does not model. Use " +
  "graph_diagnostics for type errors."

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
