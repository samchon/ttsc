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
// @evidence contracts/testing.md#execution-ownership This e2e-tagged public Go entry is selected by the central native connection experiment and starts the actual compiled command. Default Go units exercise run separately.
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
