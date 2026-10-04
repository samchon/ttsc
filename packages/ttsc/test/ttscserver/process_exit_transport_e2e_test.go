//go:build e2e

package ttscserver_test

import (
  "strings"
  "testing"
)

// TestTtscserverProcessExitTransport verifies main transfers successful and rejected dispatch to OS exits and streams.
//
// Direct command units own the complete alias and rejection matrix. These two
// invocations keep the actual executable entry, argv, exit status and pipe
// connection observable without repeating every portable command variation.
//
// 1. Start the suite's once-built executable without arguments.
// 2. Assert OS exit zero and the literal help banner from actual stdout.
// 3. Start the same artifact with a rejected argument and assert OS exit two
//    and the literal rejection diagnostic from actual stderr.
//
// @evidence contracts/testing.md#behavioral-verification The actual executable with empty argv returns OS status zero and the literal help banner; a rejected argument returns OS status two and its literal diagnostic. Each invocation has its own named failure identity.
// @evidence contracts/testing.md#independent-expectations Supported default help and usage-error contracts independently define statuses zero/two and literal fragments. Assertions observe real pipe bytes and do not calculate expectations from captured results.
// @evidence contracts/testing.md#distinguishing-cases Successful main exit and rejected main exit exercise both os.Exit paths. All remaining portable aliases and rejection variants have named direct unit owners; these calls do not certify those aliases' executable wiring individually.
// @evidence contracts/testing.md#execution-ownership This e2e-tagged public Go entry starts the actual compiled command when selected with -tags=e2e; authored discovery is not runtime certification. Default Go units exercise run separately.
// @evidence contracts/e2e.md#necessary-boundary Real compiled main and native OS exits connect empty/rejected argv to stdout/stderr; portable run calls cannot certify that executable connection.
// @evidence contracts/e2e.md#shared-execution Both named outcomes share the suite's sync.Once command build and SDK path resolution; distinct os.Exit results require distinct child invocations.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fixed artifact inputs and per-invocation buffers separate help and rejection. cmd.Run joins direct child and stream copy; TestMain removes the build directory, not arbitrary descendants or loaded-image state.
// @evidence contracts/e2e.md#preserved-coverage Both original status/literal-output checks and rejected-argument identity remain. Complete alias semantics belong to direct units, not these two process outcomes.
func TestTtscserverProcessExitTransport(t *testing.T) {
  t.Run("success", func(t *testing.T) {
    code, out, errOut := runTtscserver(t)
    if code != 0 || !strings.Contains(out, "Language Server Protocol host") {
      t.Fatalf("successful main transport mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
    }
  })
  t.Run("rejected", func(t *testing.T) {
    code, out, errOut := runTtscserver(t, "--garbage-flag")
    if code != 2 || !strings.Contains(errOut, "flag provided but not defined") {
      t.Fatalf("rejected main transport mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
    }
    if !strings.Contains(errOut, "garbage-flag") { t.Fatalf("missing rejected argument: %q", errOut) }
  })
}
