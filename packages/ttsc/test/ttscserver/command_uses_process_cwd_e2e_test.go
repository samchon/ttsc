//go:build e2e

package ttscserver_test

import "testing"

// TestTtscserverCommandUsesProcessCwd verifies the implicit cwd path: when
// the user omits --cwd, the host resolves the project root from the process
// working directory.
//
// Most editor launchers spawn ttscserver with cwd set to the workspace root
// and rely on the implicit Getwd fallback to locate the TypeScript project.
// An explicit --cwd should not be required for the common editor case.
//
// 1. Run ttscserver --stdio without --cwd, from a fresh temp directory.
// 2. Close stdin immediately to trigger clean shutdown.
// 3. Assert exit 0.
//
// @evidence contracts/testing.md#behavioral-verification ttscserver --stdio without --cwd accepts the invocation from a fresh directory and exits zero on EOF.
// @evidence contracts/testing.md#independent-expectations Implicit cwd is an accepted editor-launch mode. Status proves acceptance and shutdown only; it does not prove the resolved directory identity.
// @evidence contracts/testing.md#distinguishing-cases Omitting cwd differs from the explicit-cwd EOF case; no project-sensitive assertion is claimed by this fixture.
// @evidence contracts/testing.md#execution-ownership TestTtscserverCommandUsesProcessCwd is an individually discoverable Go E2E entry selected by the central ttsc package experiment; -tags=e2e separates it from direct units, and its loops retain each existing assertion and named subtest.
func TestTtscserverCommandUsesProcessCwd(t *testing.T) {
  code, _, errOut := runTtscserverFromDir(t, t.TempDir(), "", "--stdio")
  if code != 0 {
    t.Fatalf("expected clean exit, got %d (stderr=%q)", code, errOut)
  }
}
