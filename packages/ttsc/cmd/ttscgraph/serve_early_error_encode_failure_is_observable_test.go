package main

import (
  "bytes"
  "errors"
  "strings"
  "testing"
)

type rejectedServeWriter struct{}

func (rejectedServeWriter) Write([]byte) (int, error) {
  return 0, errors.New("synthetic response write failure")
}

// TestServeEarlyErrorEncodeFailureIsObservable proves a rejected early error
// response fails the stream without claiming that an unencoded response ran.
//
//  1. Reject protocol negotiation before a graph session is constructed.
//  2. Fail the response writer and require a nonzero server result.
//  3. Require the stderr cause while forbidding successful phase rows.
//
// @evidence contracts/testing.md#behavioral-verification TestServeEarlyErrorEncodeFailureIsObservable proves a rejected early error response fails the stream without claiming that an unencoded response ran.
// @evidence contracts/testing.md#independent-expectations The expected outcome follows from the serve contract that an unencodable response must fail the stream: the writer always errors, so the test requires a nonzero exit, the stderr text 'write serve response: synthetic response write failure', and no ttscgraph-phase rows even though tracing is enabled. A server that swallowed the write error or logged timings for an unsent response fails.
// @evidence contracts/testing.md#distinguishing-cases Reject protocol negotiation before a graph session is constructed; Fail the response writer and require a nonzero server result; Require the stderr cause while forbidding successful phase rows.
// @evidence contracts/testing.md#execution-ownership TestServeEarlyErrorEncodeFailureIsObservable is a Go source-unit entry. It calls serveSnapshots in-process with an unsupported graphSnapshotVersion, so the protocol rejection is encoded before any compiler session or Git acquisition happens; the writer is a failing stub, so nothing is installed, built or launched.
func TestServeEarlyErrorEncodeFailureIsObservable(t *testing.T) {
  root := graphSessionFixture(t)
  oldStderr := stderr
  defer func() { stderr = oldStderr }()
  t.Setenv(graphPhaseTraceEnvironment, "1")

  var diagnostic bytes.Buffer
  stderr = &diagnostic
  request := "{\"id\":29,\"graphSnapshotVersion\":99}\n"
  if code := serveSnapshots(strings.NewReader(request), rejectedServeWriter{}, root, "tsconfig.json"); code == 0 {
    t.Fatal("failed early error encoding returned success")
  }
  if !strings.Contains(diagnostic.String(), "write serve response: synthetic response write failure") {
    t.Fatalf("failed early error encoding hid its cause: %q", diagnostic.String())
  }
  if strings.Contains(diagnostic.String(), "ttscgraph-phase") {
    t.Fatalf("failed early error encoding claimed successful phase rows: %q", diagnostic.String())
  }
}
