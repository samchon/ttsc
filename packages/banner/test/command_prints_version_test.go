package banner_test

import (
	"strings"
	"testing"
)

// TestCommandPrintsVersion verifies the banner sidecar exposes its version command.
//
// The banner sidecar is intentionally tested through its package-local command front door.
// These cases prove the small wrapper package can parse host commands, hand project work to the
// shared utility host, and place documentation text without relying on tests inside the plugin
// implementation directory.
//
// Version output is a host-discovery path rather than a project transform. The scenario keeps
// it independent from tsconfig and plugin manifest parsing so a broken project cannot mask
// command metadata regressions.
//
// 1. Invoke the version branch through the real command wrapper.
// 2. Observe stdout and stderr exactly as the host would see them.
// 3. Assert a successful status and the @ttsc/banner banner text.
func TestCommandPrintsVersion(t *testing.T) {
	// Version assertion: wrappers use this path to check binary identity without
	// paying the cost of compiler or plugin setup.
	code, stdout, stderr := runPlugin(t, "version")
	if code != 0 || !strings.Contains(stdout, "@ttsc/banner 0.0.1") || stderr != "" {
		t.Fatalf("version branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
