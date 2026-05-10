package strip_test

import (
	"strings"
	"testing"
)

// TestCommandPrintsVersion verifies the strip sidecar exposes its version command.
//
// The strip sidecar is tested through its package wrapper because hosts care about emitted
// JavaScript with selected statements removed. These scenarios keep command dispatch, project
// loading, and the shared utility transform path observable from the package boundary.
//
// The version branch is command metadata and should not depend on a tsconfig fixture. This
// protects package discovery and smoke checks from project-specific failures.
//
// 1. Invoke the version branch through the real wrapper.
// 2. Capture the process streams exactly as the host would.
// 3. Assert successful status and the @ttsc/strip banner text.
func TestCommandPrintsVersion(t *testing.T) {
	// Version assertion: this is a cheap binary identity check for callers that
	// do not want to construct a TypeScript fixture.
	code, stdout, stderr := runPlugin(t, "version")
	if code != 0 || !strings.Contains(stdout, "@ttsc/strip 0.0.1") || stderr != "" {
		t.Fatalf("version branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
