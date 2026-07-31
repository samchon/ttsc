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
