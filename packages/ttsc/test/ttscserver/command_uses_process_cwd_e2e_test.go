//go:build e2e

package ttscserver_test

import "testing"

// TestTtscserverCommandUsesProcessCwd verifies the implicit cwd path: when
// the user omits --cwd, the host accepts the invocation and EOF from a private
// process working directory. Its resolved root identity is not observed here.
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
// @evidence contracts/testing.md#execution-ownership This e2e-tagged Go entry makes one actual command invocation without cwd flags. Body authoring does not prove selection or runtime success.
// @evidence contracts/e2e.md#necessary-boundary Actual executable argument admission/default cwd and stdin EOF must reach OS status zero; direct command calls do not connect native process cwd to the entry point.
// @evidence contracts/e2e.md#shared-execution The package's once-built command and once-resolved SDK binary serve this new EOF-ending session, without another build for omitted cwd.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh private cwd and invocation-local buffers separate this omitted-option case. cmd.Run waits for the direct child and stream copy, and TestMain owns artifact removal; no resolved-root or descendant identity is certified.
// @evidence contracts/e2e.md#preserved-coverage The original implicit-cwd acceptance and EOF status remain; no project-sensitive result or initialize response is inferred.
func TestTtscserverCommandUsesProcessCwd(t *testing.T) {
  code, _, errOut := runTtscserverFromDir(t, t.TempDir(), "", "--stdio")
  if code != 0 {
    t.Fatalf("expected clean exit, got %d (stderr=%q)", code, errOut)
  }
}
