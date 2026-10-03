package lspserver

import (
  "bytes"
  "os/exec"
  "testing"
)

// TestLSPHintsAbsenceIsNotAnError checks silent discovery for an unresolved binary.
//
// Failed execution and a rejected optional verb share discovery's run-error
// branch, but this unit supplies only the former. It does not run a legacy
// plugin, identify why a real plugin rejected a verb or certify every failure.
//
//  1. Discover hints from a plugin whose sidecar cannot answer.
//  2. Assert the corpus is empty.
//  3. Assert nothing was written to the log.
//
// @evidence contracts/testing.md#behavioral-verification Actual discoverCompletionHints on the supplied unresolved binary leaves CompletionHints empty and writes no bytes to the owned logger. The test does not observe a successfully started producer or certify rejection of an unsupported verb.
// @evidence contracts/testing.md#independent-expectations Zero hints and zero log bytes are literal expectations for the supported silent run-error branch. With no seeded corpus, these observations do not independently prove an attempted invocation or successful producer decoding.
// @evidence contracts/testing.md#distinguishing-cases The unresolved executable supplies a run error, not a successful producer's unknown-verb reply or malformed JSON. Those causes are not distinguished by this unit; no universal legacy-plugin compatibility is certified.
// @evidence contracts/testing.md#execution-ownership This Go unit calls actual native discovery with an owned bytes.Buffer logger and requires native LookPath to reject the supplied binary beforehand. Actual resident/direct command paths attempt the unresolved selection; no sidecar is installed or successfully started. No temporary directory or substituted discovery operation exists; runtime selection and native execution remain unverified.
func TestLSPHintsAbsenceIsNotAnError(t *testing.T) {
  const missingBinary = "ttsc-no-such-plugin-binary"
  if _, err := exec.LookPath(missingBinary); err == nil {
    t.Fatalf("missing sidecar premise failed: %q resolves to an executable", missingBinary)
  }
  var log bytes.Buffer
  source := &NativePluginSource{
    err: &log,
    plugins: []NativeLSPPluginEntry{
      {Binary: missingBinary, Name: "@ttsc/legacy"},
    },
  }

  source.discoverCompletionHints(1)

  if hints := source.CompletionHints(); len(hints) != 0 {
    t.Errorf("a plugin that could not answer contributed %d hints", len(hints))
  }
  if log.Len() != 0 {
    t.Errorf(
      "unresolved hint discovery wrote unexpected log bytes:\n%s",
      log.String(),
    )
  }
}
