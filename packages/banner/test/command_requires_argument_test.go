package banner_test

import (
	"strings"
	"testing"
)

// TestCommandRequiresArgument verifies the banner sidecar rejects an empty command line.
//
// The banner sidecar is intentionally tested through its package-local command front door.
// These cases prove the small wrapper package can parse host commands, hand project work to the
// shared utility host, and place documentation text without relying on tests inside the plugin
// implementation directory.
//
// The native host must fail before project loading when no command is supplied. That keeps
// usage errors separate from TypeScript diagnostics and gives package managers a stable
// exit-code contract.
//
// 1. Run the real plugin binary without a subcommand.
// 2. Recover the wrapped program status from go run.
// 3. Assert the usage diagnostic and command-error exit code.
func TestCommandRequiresArgument(t *testing.T) {
	// Command assertion: this is the front-door guard for malformed invocations
	// from a wrapper script or an incorrectly constructed plugin descriptor.
	code, stdout, stderr := runPlugin(t)
	if code != 2 || stdout != "" || !strings.Contains(stderr, "command required") {
		t.Fatalf("no-args branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
