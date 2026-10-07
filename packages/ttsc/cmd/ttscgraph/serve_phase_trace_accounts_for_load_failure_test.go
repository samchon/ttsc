package main

import (
  "bytes"
  "strings"
  "testing"
)

// TestServePhaseTraceAccountsForLoadFailure checks the five phase labels and
// duration prefixes on an addressed load error. It does not validate timing
// values or exclude every possible payload fragment.
//
//  1. Request a missing tsconfig with phase tracing enabled.
//  2. Require a normal addressed error response rather than process failure.
//  3. Require all five phase prefixes under mode=error and reject the named fixture fragments.
//
// @evidence contracts/testing.md#behavioral-verification The addressed missing-config response carries id 23 and mode error, and the captured diagnostic contains each named phase with its duration prefix. The test rejects the root path, missing-config name fragment and JSON object opener; it does not authenticate duration values or all possible disclosures.
// @evidence contracts/testing.md#independent-expectations The literal phase-trace contract supplies owner=producer request=23 mode=error phase=<name> durationMs= and the five phase names. Independent forbidden fragments are the fixture root, missing-tsconfig and the object opener { followed by a quotation mark. Missing prefixes or these disclosures fail; duplicate rows, numeric duration accuracy and other payload fragments are not asserted.
// @evidence contracts/testing.md#distinguishing-cases Request a missing tsconfig with phase tracing enabled; require an addressed error response with server status zero; require the five phase prefixes under mode=error and reject the named fixture fragments.
// @evidence contracts/testing.md#execution-ownership TestServePhaseTraceAccountsForLoadFailure is a Go source-unit entry. It calls serveSnapshots in-process with a missing tsconfig name so session creation fails before any projection or Git acquisition; stderr is captured, and nothing is installed, built or launched.
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
