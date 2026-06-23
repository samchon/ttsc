package mcp

import (
  "bufio"
  "io"
)

// maxMessageBytes caps a single JSON-RPC line. Tool results carry verbatim
// source, so the limit is generous; the default 64 KB scanner token is not.
const maxMessageBytes = 16 * 1024 * 1024

// Serve runs the MCP stdio transport: it reads newline-delimited JSON-RPC
// messages from in, dispatches each through the resident server, and writes the
// newline-delimited responses to out, flushing after each so a client blocked on
// a reply unblocks immediately. It returns when in reaches EOF.
func (s *Server) Serve(in io.Reader, out io.Writer) error {
  scanner := bufio.NewScanner(in)
  scanner.Buffer(make([]byte, 0, 64*1024), maxMessageBytes)
  writer := bufio.NewWriter(out)
  for scanner.Scan() {
    line := scanner.Bytes()
    if len(line) == 0 {
      continue
    }
    resp, ok := s.Handle(line)
    if !ok {
      continue
    }
    if _, err := writer.Write(resp); err != nil {
      return err
    }
    if err := writer.WriteByte('\n'); err != nil {
      return err
    }
    if err := writer.Flush(); err != nil {
      return err
    }
  }
  return scanner.Err()
}
