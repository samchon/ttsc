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
// Answering an unparseable line with an error carrying the zero ID, because none
// could be parsed, would have no addressee: the launcher
// matches a response to a pending request by id and drops anything else, and its
// ids start at 1, so the frame would be discarded and the caller's promise never
// settle — a graph call would hang forever on a line the client itself sent. There is
// no recoverable reading of a line the protocol cannot address, so failing the
// stream is the honest outcome: the exit carries this stderr to the client,
// which rejects every pending request with it.
//
//  1. Send a non-JSON line, then a valid request that must never be served.
//  2. Assert serveSnapshots exits non-zero and names the offending line.
//  3. Assert no response frame was written, since none could be addressed.
//
// @evidence contracts/testing.md#behavioral-verification Verifies a malformed NDJSON line ends the stream with a diagnostic on stderr instead of answering with a reply nobody can read.
// @evidence contracts/testing.md#independent-expectations The expectation is the protocol rule that a line with no parsable id cannot be answered: a non-JSON line followed by a valid request must produce a nonzero exit, the stderr text 'unaddressable serve request', and zero bytes on the output stream, so the later valid request is never served. A server that replied with a zero-id error frame fails the empty-output check.
// @evidence contracts/testing.md#distinguishing-cases Send a non-JSON line, then a valid request that must never be served; Assert serveSnapshots exits non-zero and names the offending line; Assert no response frame was written, since none could be addressed.
// @evidence contracts/testing.md#execution-ownership TestServeProtocolFailsTheStreamOnAnUnaddressableRequestLine is a Go source-unit entry. It calls serveSnapshots in-process; the first line fails JSON decoding before any session or Git acquisition happens, so nothing is installed, built or launched.
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
