package linthost

import (
  "path/filepath"
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
//  4. Remove only the eval statement and require the retained JSON/void source
//     to pass with empty output under the same selector and message.
//
// @evidence contracts/testing.md#behavioral-verification Actual in-process check returns code two, no stdout and the custom diagnostic once on the eval/JSON source; the same configuration accepts the JSON/void-only control with zero status and empty output.
// @evidence contracts/testing.md#independent-expectations Authored selector and message specify eval rather than JSON.stringify; the fixed custom text verifies parsed option transport, and the retained JSON/void-only source independently must remain clean.
// @evidence contracts/testing.md#distinguishing-cases The original eval/JSON/void source reports the custom message once; removing only eval requires zero status and empty output, distinguishing the intended call from reporting the adjacent JSON call instead. Invalid-selector command test owns rejection before dispatch.
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), "const safe = JSON.stringify(1);\nvoid safe;\n")
  code, stdout, stderr = captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("adjacent JSON/void control mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
