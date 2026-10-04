package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoMisusedPromises verifies a reduced condition trigger from the lint rule corpus
// no-misused-promises.ts under a real Program.
//
// `typescript/no-misused-promises` is type-aware: a parser-only engine run skips it
// because Context.Checker is nil. The rule reuses the `command_*` shape established
// by `no-floating-promises`'s corpus test: materialize a tsconfig project, run
// `ttsc lint check`, and assert on the rendered diagnostics.
//
// 1. Seed a project that places a Promise in an `if` condition.
// 2. Run `check` with typescript/no-misused-promises enabled as error.
// 3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification Promise conditions must emit the exact rule error without reporting synchronous boolean conditions.
// @evidence contracts/testing.md#independent-expectations The authored if condition fixes one rendered error on line 3, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases A Promise<boolean> condition is positive and a synchronous boolean condition is clean; no checker-less harness substitutes for the real type-aware Program.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoMisusedPromises executes the in-process check command over a real Program/Checker; disposable fixture configuration feeds that operation without a compiler child, installation or native plugin build.
func TestRuleCorpusNoMisusedPromises(t *testing.T) {
  root := seedLintProject(t, `declare function getPromise(): Promise<boolean>;
async function main(): Promise<void> {
  if (getPromise()) {
    JSON.stringify("hit");
  }
}
void main();
`)
  seedLintRules(t, root, map[string]string{"typescript/no-misused-promises": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-misused-promises]") {
    t.Fatalf("no-misused-promises diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  matches := noMisusedPromisesRenderedDiagnostic.FindAllStringSubmatch(noMisusedPromisesANSI.ReplaceAllString(stderr, ""), -1)
  if len(matches) != 1 || matches[0][1] != "3" { t.Fatalf("condition rule diagnostics = %v, want one error at line 3", matches) }
  lines, cleanCode, cleanStdout, cleanStderr := runNoMisusedPromisesCase(t, "main.ts", "declare const condition: boolean;\nif (condition) { JSON.stringify(\"hit\"); }\n", nil)
  if cleanCode != 0 || cleanStdout != "" || len(lines) != 0 { t.Fatalf("synchronous condition = code %d lines %v stderr %s", cleanCode, lines, cleanStderr) }
}
