package paths_test

import (
  "strings"
  "testing"
)

// TestCommandRejectsInvalidPluginManifest rejects malformed paths plugin manifests.
//
// The wrapper dispatches build, transform, and check into the shared utility host. A malformed
// plugin manifest exercises the failure return from each command without depending on alias
// resolution, TypeScript diagnostics, or emitted output.
//
// This covers the command paths that existing happy cases reach only on success. Each branch
// should preserve the utility error status and avoid writing host-facing stdout payloads.
//
// 1. Invoke build, transform, and check with malformed --plugins-json input.
// 2. Capture each command's status and streams through the real wrapper.
// 3. Assert every command returns the utility failure status and invalid-manifest diagnostic.
func TestCommandRejectsInvalidPluginManifest(t *testing.T) {
  // Failure assertion: parsePluginEntries runs before project loading, keeping
  // the scenario narrow and stable across path fixture changes.
  for _, command := range []string{"build", "transform", "check"} {
    code, stdout, stderr := runPlugin(t, command, "--plugins-json={")
    if code != 2 || stdout != "" || !strings.Contains(stderr, "ttsc utility: invalid --plugins-json") {
      t.Fatalf("%s invalid manifest mismatch: code=%d stdout=%q stderr=%q", command, code, stdout, stderr)
    }
  }
}
