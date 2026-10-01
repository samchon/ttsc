package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckNoParamReassignHonorsPropsConfig protects option transport
// through parsed JSON, Program/checker construction, rendering and exit code.
//
// @evidence contracts/testing.md#behavioral-verification The actual in-process check operation returns code two with one value-property diagnostic, no stdout and no ignored-parameter diagnostic.
// @evidence contracts/testing.md#independent-expectations The authored JSON enables props and exempts only ignored; the exact value-property message independently specifies the expected transported behavior.
// @evidence contracts/testing.md#distinguishing-cases The configured `value.field = 1` property write reports exactly once; the `ignored.field = 1` write exempted by ignorePropertyModificationsFor produces no diagnostic naming 'ignored', and the same-named block-local `let value` reassignment produces no direct-parameter-assignment diagnostic (stderr must not contain "Assignment to function parameter"). Invalid-option command cases own rejection before dispatch.
// @evidence contracts/testing.md#execution-ownership TestCommandCheckNoParamReassignHonorsPropsConfig is selected in the shared Go unit population. It calls run(check) in-process on a real fixture project and parsed config with an explicit lint manifest; Program/Checker and diagnostic rendering run, without a CLI child or installed consumer. No consumer install, native artifact build or real host runs.
func TestCommandCheckNoParamReassignHonorsPropsConfig(t *testing.T) {
  root := seedLintProject(t, `function mutate(value: any, ignored: any): void {
  value.field = 1;
  ignored.field = 1;
  { let value = 0; value = 1; }
}
JSON.stringify(mutate);
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "no-param-reassign": []any{
        "error",
        map[string]any{
          "props":                          true,
          "ignorePropertyModificationsFor": []string{"ignored"},
        },
      },
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  const message = "[no-param-reassign] Assignment to property of function parameter 'value'."
  if code != 2 || stdout != "" || strings.Count(stderr, message) != 1 || strings.Contains(stderr, "parameter 'ignored'") ||
    strings.Contains(stderr, "Assignment to function parameter") {
    t.Fatalf("no-param-reassign command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
