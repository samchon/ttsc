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
// The malformed first line cannot supply an addressed request. This source
// operation must return failure with a diagnostic and no response bytes, even
// though a valid request follows it. Client promise settlement and OS process
// exit propagation are not exercised here.
//
//  1. Send a non-JSON line, then a valid request that must never be served.
//  2. Assert serveSnapshots returns nonzero and the diagnostic names the failure category.
//  3. Assert no response frame was written, since none could be addressed.
//
// @evidence contracts/testing.md#behavioral-verification Verifies a malformed NDJSON line ends the stream with a diagnostic on stderr instead of answering with a reply nobody can read.
// @evidence contracts/testing.md#independent-expectations The expectation is the protocol rule that a line with no parsable id cannot be answered: a non-JSON line followed by a valid request must produce a nonzero exit, the stderr text 'unaddressable serve request', and zero bytes on the output stream, so the later valid request is never served. A server that replied with a zero-id error frame fails the empty-output check.
// @evidence contracts/testing.md#distinguishing-cases Send a non-JSON line followed by a valid request; require a nonzero returned status and the literal unaddressable serve request diagnostic category; require zero output bytes, including no response to the later valid request.
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
