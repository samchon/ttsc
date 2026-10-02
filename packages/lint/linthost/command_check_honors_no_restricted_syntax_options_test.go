package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckHonorsNoRestrictedSyntaxOptions verifies the check command
// carries a no-restricted-syntax selector and custom message from the lint
// configuration into the rule.
//
// A severity-only configuration cannot show that the rule receives its option
// tuple, so the selector must decide which call is reported and the message
// must be the configured text. An `eval` call and an adjacent
// `JSON.stringify` call share one source to show the selector discriminates.
//
//  1. Seed a project with `eval("1")` and a `JSON.stringify(1)` call.
//  2. Write a lint configuration restricting `CallExpression[callee.name='eval']`
//     with a custom message and run `check` in this process.
//  3. Assert status 2, empty stdout and exactly one diagnostic carrying the
//     custom message.
//
// @evidence contracts/testing.md#behavioral-verification Actual in-process check returns code two, no stdout and exactly one configured custom eval diagnostic.
// @evidence contracts/testing.md#independent-expectations Authored selector and message specify eval rather than the adjacent JSON.stringify call; the fixed custom text independently verifies parsed option transport.
// @evidence contracts/testing.md#distinguishing-cases Eval reports once while the original JSON call and void expression stay clean; invalid-selector command test owns rejection before dispatch.
// @evidence contracts/testing.md#execution-ownership TestCommandCheckHonorsNoRestrictedSyntaxOptions is selected in the shared Go unit population. It materializes the actual source/config fixture and calls run(check) in-process with an explicit lint manifest; no CLI child is started. No installed consumer, native artifact build or real product host runs.
func TestCommandCheckHonorsNoRestrictedSyntaxOptions(t *testing.T) {
  root := seedLintProject(t, `eval("1");
const safe = JSON.stringify(1);
void safe;
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "no-restricted-syntax": []any{
        "error",
        map[string]any{
          "selector": "CallExpression[callee.name='eval']",
          "message":  "Do not evaluate source text.",
        },
      },
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || strings.Count(stderr, "[no-restricted-syntax] Do not evaluate source text.") != 1 {
    t.Fatalf("valid command path mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
