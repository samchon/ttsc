package main

import (
  "reflect"
  "testing"
)

// TestMainAliasBranches verifies a .cts operand selects build preparation and preserves its argv.
//
// Unknown labels can return the same status two as a failing build. The actual private preparation result distinguishes the build branch and unchanged operand; the retained run assertion observes only its existing failure status. The build FlagSet leaves positional operands unused, so no claim is made that project.cts itself is inspected.
//
// 1. Prepare the literal project.cts argument through the real dispatcher preparation.
// 2. Assert build kind, unchanged singleton argv and successful empty-stream preparation.
// 3. Retain the original complete run status-two assertion.
//
// @evidence contracts/testing.md#behavioral-verification Actual prepareCommandInvocation must select commandBuild and preserve the literal project.cts argv with status zero and no output; the original run call still checks status two.
// @evidence contracts/testing.md#independent-expectations Literal build-kind, singleton project.cts and empty preparation streams independently distinguish alias selection from unknown-command status two. The final full run status does not identify a missing .cts-file inspection.
// @evidence contracts/testing.md#distinguishing-cases The .cts extension-shaped operand is the distinguishing accepted preparation case; unknown demo and fly-to-mars rejection and other aliases are owned by the aggregate family and existing dispatcher branch tests.
// @evidence contracts/testing.md#execution-ownership This same-process Go unit observes the actual private production preparation consumed by run, then retains real run invocation. captureCommand restores stream/getwd seams. It acquires no product child or native artifact; the original complete run may attempt default cwd config resolution.
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

  code, _, _ = captureCommand(t, func() int {
    return run([]string{"project.cts"})
  })
  if code != 2 {
    t.Fatalf("cts build alias status mismatch: %d", code)
  }
}
