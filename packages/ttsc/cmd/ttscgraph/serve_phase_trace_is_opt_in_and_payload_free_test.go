package main

import (
  "bytes"
  "strings"
  "testing"
)

// TestServePhaseTraceIsOptInAndPayloadFree proves the benchmark diagnostic is
// disabled by default and exposes timings without project or request content.
//
//  1. Run the same shard request through the source owner with tracing disabled and enabled.
//  2. Capture only the server diagnostic stream, not the response payload.
//  3. Require the five named phases and reject fixture paths and JSON bodies.
//
// @evidence contracts/testing.md#behavioral-verification TestServePhaseTraceIsOptInAndPayloadFree proves the benchmark diagnostic is disabled by default and exposes timings without project or request content.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish the five named phases and reject fixture paths and JSON bodies.
// @evidence contracts/testing.md#distinguishing-cases Run the same shard request through the source owner with tracing disabled and enabled; Capture only the server diagnostic stream, not the response payload; Require the five named phases and reject fixture paths and JSON bodies.
// @evidence contracts/testing.md#execution-ownership TestServePhaseTraceIsOptInAndPayloadFree is a Go source-unit entry. serveSnapshotRequests performs actual NDJSON decoding and resident lifecycle through the source publisher; prepared projection consumes explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServePhaseTraceIsOptInAndPayloadFree(t *testing.T) {
  root := graphSessionFixture(t)
  request := "{\"id\":17,\"graphSnapshotVersion\":1}\n"
  oldStderr := stderr
  defer func() { stderr = oldStderr }()

  t.Setenv(graphPhaseTraceEnvironment, "")
  var disabled bytes.Buffer
  stderr = &disabled
  if code := serveSourceSnapshots(strings.NewReader(request), &bytes.Buffer{}, root, "tsconfig.json"); code != 0 {
    t.Fatalf("disabled trace exited %d", code)
  }
  if disabled.Len() != 0 {
    t.Fatalf("disabled trace wrote %q", disabled.String())
  }

  t.Setenv(graphPhaseTraceEnvironment, "1")
  var enabled bytes.Buffer
  stderr = &enabled
  if code := serveSourceSnapshots(strings.NewReader(request), &bytes.Buffer{}, root, "tsconfig.json"); code != 0 {
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
