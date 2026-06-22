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
  "pre-walked by the real type checker. For any structural question (what calls or relates to a " +
  "symbol, what it extends, the blast radius of a change, where something is declared) call " +
  "graph_explore FIRST and answer from its result: it returns the verbatim declaration source, the " +
  "exact incoming and outgoing edges, and the transitive-dependent count, so you do NOT need to grep " +
  "or re-read files to confirm. Doing so wastes turns. Use graph_diagnostics for a file's type " +
  "errors. Edges are type-resolved (barrel re-exports and cross-package references are followed to " +
  "the real declaration); a node_modules or .d.ts target is an external leaf the graph does not walk into."

// Server answers MCP requests from a resident Program and the graph built from it.
type Server struct {
  prog  *driver.Program
  graph *graph.Graph
}

// NewServer builds the resident graph from prog once. The Program stays open for
// the server's lifetime; every tool call reads from this warm handle.
func NewServer(prog *driver.Program) *Server {
  return &Server{prog: prog, graph: graph.Build(prog)}
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
    result, rpcErr := s.callTool(req.Params)
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
