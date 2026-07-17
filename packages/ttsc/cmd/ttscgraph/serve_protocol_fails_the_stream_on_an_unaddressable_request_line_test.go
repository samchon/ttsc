package main

import (
  "bytes"
  "strings"
  "testing"
)

// TestServeProtocolFailsTheStreamOnAnUnaddressableRequestLine verifies a
// malformed NDJSON line ends the stream with a diagnostic on stderr instead of
// answering with a reply nobody can read.
//
// The server used to answer an unparseable line with an error carrying the zero
// ID, because none could be parsed. That reply had no addressee: the launcher
// matches a response to a pending request by id and drops anything else, and its
// ids start at 1, so the frame was discarded and the caller's promise never
// settled — a graph call hung forever on a line the client itself sent. There is
// no recoverable reading of a line the protocol cannot address, so failing the
// stream is the honest outcome: the exit carries this stderr to the client,
// which rejects every pending request with it.
//
//  1. Send a non-JSON line, then a valid request that must never be served.
//  2. Assert serveSnapshots exits non-zero and names the offending line.
//  3. Assert no response frame was written, since none could be addressed.
func TestServeProtocolFailsTheStreamOnAnUnaddressableRequestLine(t *testing.T) {
  root := graphSessionFixture(t)
  oldStderr := stderr
  defer func() { stderr = oldStderr }()
  var errOut bytes.Buffer
  stderr = &errOut

  input := strings.NewReader("not-json\n{\"id\":1}\n")
  var output bytes.Buffer
  if code := serveSnapshots(input, &output, root, "tsconfig.json"); code == 0 {
    t.Fatalf("serveSnapshots accepted an unaddressable line: %q", output.String())
  }
  if !strings.Contains(errOut.String(), "unaddressable serve request") {
    t.Fatalf("stderr did not explain the failure: %q", errOut.String())
  }
  if output.Len() != 0 {
    t.Fatalf("serveSnapshots answered an unaddressable line: %q", output.String())
  }
}
