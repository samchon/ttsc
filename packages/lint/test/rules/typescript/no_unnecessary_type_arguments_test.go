package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnnecessaryTypeArguments verifies the lint rule
// corpus fixture typescript-no-unnecessary-type-arguments.ts under a
// real Program.
//
// `typescript/no-unnecessary-type-arguments` is type-aware: it resolves
// the generic's symbol via the Checker, walks the declaration's
// type-parameter list, and compares each explicit argument's type
// against the parameter's declared default. The engine's checker-less
// AST harness used by `assertRuleCorpusCase` skips it because
// Context.Checker is nil, so this Go scenario seeds a real tsconfig
// project, runs `ttsc lint check`, and asserts on the rendered
// diagnostics.
//
//  1. Seed a project where a `function withDefault<T = string>()` is
//     called as `withDefault<string>("hello")` — the explicit argument
//     repeats the declared default.
//  2. Run `check` with typescript/no-unnecessary-type-arguments enabled
//     as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
// @evidence contracts/testing.md#behavioral-verification An explicit generic argument repeating its declared default must report.
// @evidence contracts/testing.md#independent-expectations The authored original source requires exactly one typescript/no-unnecessary-type-arguments rendered error at line 2, exit code 2 and empty stdout; an independently authored clean source requires code 0 and no rule findings.
// @evidence contracts/testing.md#distinguishing-cases An explicit number argument differs from the string default and stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnnecessaryTypeArguments runs the real Program/Checker via the in-process check command and shared typed semantic oracles; fixture project files configure the operation without installing, building a native artifact or spawning a compiler.
func TestRuleCorpusNoUnnecessaryTypeArguments(t *testing.T) {
  root := seedLintProject(t, `declare function withDefault<T = string>(value: T): T;
const out = withDefault<string>("hello");
JSON.stringify(out);
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unnecessary-type-arguments": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unnecessary-type-arguments]") {
    t.Fatalf("no-unnecessary-type-arguments diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-unnecessary-type-arguments", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/no-unnecessary-type-arguments", "declare function withDefault<T = string>(value: T): T;\nconst out = withDefault<number>(1);\nJSON.stringify(out);\n")
}
