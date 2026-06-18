package ttsc_test

import (
  "strings"
  "testing"
)

// TestCommandRefusesCompilerCommands verifies build and check stay outside the helper.
//
// The platform package is a metadata and smoke-test binary, not the compiler
// host. Build and check must tell callers to use the JavaScript ttsc CLI or a
// plugin-selected sidecar instead of trying to inspect a consumer project here.
//
// This scenario covers both labels in the shared build/check refusal branch.
// The diagnostic mentions typescript because that boundary is the reason these
// commands are owned by the JavaScript launcher.
//
// 1. Invoke build and check through run.
// 2. Capture stdout and stderr for each command.
// 3. Assert command-error status and the JavaScript CLI refusal message.
func TestCommandRefusesCompilerCommands(t *testing.T) {
  for _, command := range []string{"build", "check"} {
    code, stdout, stderr := runPlatformCommand(t, command)
    if code != 2 || stdout != "" ||
      !strings.Contains(stderr, command+" is provided by the JavaScript ttsc CLI") ||
      !strings.Contains(stderr, "typescript") {
      t.Fatalf("%s refusal mismatch: code=%d stdout=%q stderr=%q", command, code, stdout, stderr)
    }
  }
}
