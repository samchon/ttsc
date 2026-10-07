package main

import (
  "reflect"
  "strings"
  "testing"
)

// TestMainAliasBranches verifies a .cts operand selects build preparation and preserves its argv.
//
// Unknown labels can return the same status two as a failing build. Actual
// preparation distinguishes the build branch and unchanged operand. The full
// call runs from an owned empty directory and requires the missing default
// config cause; project.cts remains a positional operand, not a config selector.
//
//  1. Prepare the literal project.cts argument through the real dispatcher preparation.
//  2. Assert build kind, unchanged singleton argv and successful empty-stream preparation.
//  3. Run the original argv from an empty owned cwd and require status two plus
//     the default-config absence cause.
//
// @evidence contracts/testing.md#behavioral-verification Actual prepareCommandInvocation selects commandBuild and preserves literal project.cts argv with status zero and empty streams. The full run from an owned empty cwd returns status two and reports tsconfig not found, not inspection of project.cts.
// @evidence contracts/testing.md#independent-expectations Literal build-kind, singleton project.cts and empty preparation streams distinguish alias selection from unknown-command status two. The owned empty cwd independently supplies default-config absence; status two and the literal missing-config cause distinguish that failure without certifying a .cts-file inspection.
// @evidence contracts/testing.md#distinguishing-cases The .cts extension-shaped operand is the distinguishing accepted preparation case; unknown demo and fly-to-mars rejection and other aliases are owned by the aggregate family and existing dispatcher branch tests.
// @evidence contracts/testing.md#execution-ownership This same-process Go unit observes actual private production preparation consumed by run, then invokes run with the original argv. captureCommand restores stream/getwd seams; TempDir owns the empty native fixture and testing.Chdir restores cwd. No product child or native artifact is acquired; the full call attempts actual default-config resolution.
func TestMainAliasBranches(t *testing.T) {
  code, out, errOut := captureCommand(t, func() int {
    kind, args, status := prepareCommandInvocation([]string{"project.cts"})
    if kind != commandBuild || !reflect.DeepEqual(args, []string{"project.cts"}) {
      t.Fatalf("cts build preparation mismatch: kind=%v args=%#v", kind, args)
    }
    return status
  })
  if code != 0 || out != "" || errOut != "" {
    t.Fatalf("cts preparation status/streams mismatch: code=%d stdout=%q stderr=%q", code, out, errOut)
  }

  t.Chdir(t.TempDir())
  code, _, errOut = captureCommand(t, func() int {
    return run([]string{"project.cts"})
  })
  if code != 2 {
    t.Fatalf("cts build alias status mismatch: %d", code)
  }
  if !strings.Contains(errOut, "tsconfig not found") {
    t.Fatalf("cts build alias missing-config cause mismatch: %q", errOut)
  }
}
