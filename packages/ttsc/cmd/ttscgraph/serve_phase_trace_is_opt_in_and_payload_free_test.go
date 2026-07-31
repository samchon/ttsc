package main

import (
  "bytes"
  "strings"
  "testing"
)

// TestServePhaseTraceIsOptInAndPayloadFree proves the benchmark diagnostic is
// disabled by default and exposes timings without project or request content.
//
//  1. Run the same native shard request with tracing disabled and enabled.
//  2. Capture only the server diagnostic stream, not the response payload.
//  3. Require the five named phases and reject fixture paths and JSON bodies.
func TestServePhaseTraceIsOptInAndPayloadFree(t *testing.T) {
  root := graphSessionFixture(t)
  request := "{\"id\":17,\"graphSnapshotVersion\":1}\n"
  oldStderr := stderr
  defer func() { stderr = oldStderr }()

  t.Setenv(graphPhaseTraceEnvironment, "")
  var disabled bytes.Buffer
  stderr = &disabled
  if code := serveSnapshots(strings.NewReader(request), &bytes.Buffer{}, root, "tsconfig.json"); code != 0 {
    t.Fatalf("disabled trace exited %d", code)
  }
  if disabled.Len() != 0 {
    t.Fatalf("disabled trace wrote %q", disabled.String())
  }

  t.Setenv(graphPhaseTraceEnvironment, "1")
  var enabled bytes.Buffer
  stderr = &enabled
  if code := serveSnapshots(strings.NewReader(request), &bytes.Buffer{}, root, "tsconfig.json"); code != 0 {
    t.Fatalf("enabled trace exited %d", code)
  }
  trace := enabled.String()
  for _, phase := range []string{
    "native-load",
    "semantic-refresh",
    "shard-export",
    "encode",
    "producer-total",
  } {
    if !strings.Contains(trace, "owner=producer request=17 mode=initial phase="+phase+" durationMs=") {
      t.Fatalf("trace omitted %s: %q", phase, trace)
    }
  }
  if strings.Contains(trace, root) || strings.Contains(trace, "graphSnapshotVersion") || strings.Contains(trace, "{\"") {
    t.Fatalf("trace exposed request or project content: %q", trace)
  }
}

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
