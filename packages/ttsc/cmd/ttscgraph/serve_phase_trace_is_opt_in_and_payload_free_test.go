package main

import (
  "bytes"
  "strings"
  "testing"
)

// TestServePhaseTraceIsOptInAndPayloadFree checks an empty opt-in value versus 1,
// the five phase prefixes, and absence of the named fixture fragments. Numeric
// timing accuracy and other possible disclosures are outside its assertions.
//
//  1. Run the same shard request through the source owner with tracing disabled and enabled.
//  2. Capture only the server diagnostic stream, not the response payload.
//  3. Require the five named phase prefixes and reject the root, request field and object opener.
//
// @evidence contracts/testing.md#behavioral-verification An empty trace variable leaves stderr empty; value 1 emits the five named initial-request phase prefixes. The captured trace must omit the root path, graphSnapshotVersion and the JSON object opener. This observes those selected fragments rather than all project or request information.
// @evidence contracts/testing.md#independent-expectations The opt-in contract supplies empty stderr for the empty value and literal owner=producer request=17 mode=initial phase=<name> durationMs= prefixes for value 1. Independently authored forbidden fragments are the root path, graphSnapshotVersion and the object opener { followed by a quotation mark. Duplicate rows and numeric duration accuracy are not asserted.
// @evidence contracts/testing.md#distinguishing-cases Run the same shard request through the source owner with the trace value empty and 1; capture the server diagnostic stream; require five named phase prefixes and reject the three named fixture fragments.
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
