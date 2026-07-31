package main

import (
  "bytes"
  "strings"
  "testing"
)

// TestServePhaseTraceAccountsForLoadFailure proves addressed requests retain a
// complete timing record even when no resident compiler session can be built.
//
//  1. Request a missing tsconfig with phase tracing enabled.
//  2. Require a normal addressed error response rather than process failure.
//  3. Require all five payload-free phases under mode=error.
func TestServePhaseTraceAccountsForLoadFailure(t *testing.T) {
  root := graphSessionFixture(t)
  request := "{\"id\":23,\"graphSnapshotVersion\":1}\n"
  oldStderr := stderr
  defer func() { stderr = oldStderr }()
  t.Setenv(graphPhaseTraceEnvironment, "1")

  var output bytes.Buffer
  var trace bytes.Buffer
  stderr = &trace
  if code := serveSnapshots(strings.NewReader(request), &output, root, "missing-tsconfig.json"); code != 0 {
    t.Fatalf("failed load exited %d", code)
  }
  if !strings.Contains(output.String(), `"id":23`) || !strings.Contains(output.String(), `"mode":"error"`) {
    t.Fatalf("failed load omitted its addressed error response: %q", output.String())
  }
  for _, phase := range []string{
    "native-load",
    "semantic-refresh",
    "shard-export",
    "encode",
    "producer-total",
  } {
    if !strings.Contains(trace.String(), "owner=producer request=23 mode=error phase="+phase+" durationMs=") {
      t.Fatalf("failed-load trace omitted %s: %q", phase, trace.String())
    }
  }
  if strings.Contains(trace.String(), root) || strings.Contains(trace.String(), "missing-tsconfig") || strings.Contains(trace.String(), "{\"") {
    t.Fatalf("failed-load trace exposed request or project content: %q", trace.String())
  }
}
