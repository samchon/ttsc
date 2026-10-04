//go:build e2e

package ttsc_test

import (
  "strings"
  "testing"
)

// TestPlatformProcessExitTransport verifies main transfers successful and rejected dispatch to OS exits and streams.
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
// @evidence contracts/e2e.md#necessary-boundary Actual compiled main, argv, OS status and separate streams connect dispatch to the child process; direct run calls cannot detect a broken executable entry.
// @evidence contracts/e2e.md#shared-execution Both status cases consume the package's sync.Once go-build artifact. Each fresh child is necessary for its distinct os.Exit outcome.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The suite artifact is immutable across argv-only changes; invocation-local stream buffers keep outcomes separate. cmd.Run waits for the direct child and stream copying; TestMain removes the shared directory, without descendant or loaded-image certification.
// @evidence contracts/e2e.md#preserved-coverage Success and rejection retain independent literal statuses and streams as named subtests. Portable alias variants are outside this two-outcome executable check.
func TestPlatformProcessExitTransport(t *testing.T) {
  t.Run("success", func(t *testing.T) {
    code, out, errOut := runPlatformCommand(t)
    if code != 0 || !strings.Contains(out, "ttsc platform helper.") {
      t.Fatalf("successful main transport mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
    }
    if errOut != "" { t.Fatalf("successful main stderr=%q", errOut) }
  })
  t.Run("rejected", func(t *testing.T) {
    code, out, errOut := runPlatformCommand(t, "demo")
    if code != 2 || !strings.Contains(errOut, "unknown command \"demo\"") {
      t.Fatalf("rejected main transport mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
    }
    if out != "" || !strings.Contains(errOut, `run "ttsc --help" through the JavaScript CLI`) { t.Fatalf("rejected main streams: stdout=%q stderr=%q", out, errOut) }
  })
}
