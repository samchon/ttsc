package ttsc_test

import (
	"strings"
	"testing"
)

// TestCLIRunNoArgsAttemptsProjectBuild verifies the empty ttsc command enters
// the build path.
//
// The compiler CLI treats no arguments as the standard project build lane. It
// must not silently fall back to usage text because package scripts commonly
// invoke `ttsc` with all project selection coming from the working directory.
//
// This scenario observes the real command front door rather than calling
// runBuild directly. The assertion is intentionally about dispatch behavior, so
// the local package tsconfig may either succeed or report project diagnostics.
//
// 1. Invoke the native ttsc command without arguments.
// 2. Capture stdout and stderr from the command process.
// 3. Assert the output is not the command help screen.
func TestCLIRunNoArgsAttemptsProjectBuild(t *testing.T) {
	_, stdout, stderr := runNativeCommand(t)
	if strings.Contains(stdout, "Usage:") || strings.Contains(stderr, "Usage:") {
		t.Fatalf("no-args ttsc must build the project, not print help: stdout=%q stderr=%q", stdout, stderr)
	}
}
