package banner_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsInvalidPluginManifest rejects malformed banner plugin manifests.
//
// The wrapper dispatches build, transform, and check into the shared utility host. A malformed
// plugin manifest exercises the failure return from each command without depending on TypeScript
// diagnostics or emitted project files.
//
// This covers the command paths that existing happy cases reach only on success. Each branch
// should preserve the utility error status and avoid writing host-facing stdout payloads.
//
// 1. Invoke build, transform, and check with malformed --plugins-json input.
// 2. Capture each command's status and streams through the real wrapper.
// 3. Assert every command returns the utility failure status and invalid-manifest diagnostic.
// @evidence contracts/testing.md#behavioral-verification Each compiled banner build, transform and check command receives --plugins-json={ and must return status 2, empty stdout and ttsc utility: invalid --plugins-json.
// @evidence contracts/testing.md#independent-expectations The single opening brace is deliberately malformed JSON; literal status and utility diagnostic establish failure independently of parser internals.
// @evidence contracts/testing.md#distinguishing-cases All three delegated command branches fail before project loading; the corresponding valid manifest routes execute in their separate success entries.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRejectsInvalidPluginManifest entry runs in the banner E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The three consumers verify each wrapper branch returns the utility manifest failure over its actual process channels. JSON rejection semantics are portable; repeated protocol invocations are retained here without claiming they are minimal.
// @evidence contracts/e2e.md#shared-execution All banner command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandRejectsInvalidPluginManifest, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandRejectsInvalidPluginManifest inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
func TestCommandRejectsInvalidPluginManifest(t *testing.T) {
  // Failure assertion: parsePluginEntries runs before project loading, keeping
  // the scenario narrow and stable across TypeScript fixture changes.
  for _, command := range []string{"build", "transform", "check"} {
    code, stdout, stderr := runPlugin(t, command, "--plugins-json={")
    if code != 2 || stdout != "" || !strings.Contains(stderr, "ttsc utility: invalid --plugins-json") {
      t.Fatalf("%s invalid manifest mismatch: code=%d stdout=%q stderr=%q", command, code, stdout, stderr)
    }
  }
}
