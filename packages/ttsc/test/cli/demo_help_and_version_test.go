package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLIDemoHelpAndVersion verifies lightweight command front doors that do
// not require a project.
//
// Help and version should terminate before project discovery, while demo should
// still reach the native predicate generator. Keeping the three lightweight
// front doors together makes the command smoke contract visible in one place.
//
// 1. Run help and version aliases through the real command binary.
// 2. Run the demo command for a representative native backend output.
// 3. Assert each command exits cleanly with the advertised text.
func TestCLIDemoHelpAndVersion(t *testing.T) {
  // Help assertion: help must remain a project-free command so users can run it
  // before a tsconfig exists.
  code, out, errOut := runNativeCommand(t, "--help")
  if code != 0 {
    t.Fatalf("help failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if !strings.Contains(out, "Project build:") || !strings.Contains(out, "demo") {
    t.Fatalf("help output missing expected sections:\n%s", out)
  }

  // Version assertion: the banner carries enough build metadata to debug which
  // native host is being exercised.
  code, out, errOut = runNativeCommand(t, "--version")
  if code != 0 {
    t.Fatalf("version failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if !strings.Contains(out, "ttsc ") || !strings.Contains(out, "go ") {
    t.Fatalf("version output missing runtime metadata:\n%s", out)
  }

  // Demo assertion: the smoke backend should produce deterministic JavaScript
  // for one atomic type without relying on a project fixture.
  code, out, errOut = runNativeCommand(t, "demo", "--type=number")
  if code != 0 {
    t.Fatalf("demo failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if !strings.Contains(out, `"number" === typeof input`) {
    t.Fatalf("demo output missing number predicate:\n%s", out)
  }
}
