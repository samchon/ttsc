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
func TestTtscserverCommandUsesProcessCwd(t *testing.T) {
  code, _, errOut := runTtscserverFromDir(t, t.TempDir(), "", "--stdio")
  if code != 0 {
    t.Fatalf("expected clean exit, got %d (stderr=%q)", code, errOut)
  }
}
