package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusPreferReduceTypeParameter verifies the lint rule corpus
// fixture typescript-prefer-reduce-type-parameter.ts under a real Program.
//
// `typescript/prefer-reduce-type-parameter` is type-aware: a parser-only engine run
// skips it because Context.Checker is nil. This Go scenario reuses the
// `seedLintProject` shape established by `prefer-includes` and `no-base-to-string`:
// materialize a tsconfig project, run `ttsc lint check`, and assert on the rendered
// diagnostics.
//
// The corpus fixture packages/lint/test/testdata/corpus/typescript-prefer-reduce-type-parameter.ts is run by TestLintFixtureCorpus; this Go scenario locks the minimum-viable
// trigger (`arr.reduce(cb, [] as string[])`) so a future shim regression surfaces
// here without depending on the full fixture.
//
//  1. Seed a project that calls `.reduce` on a `number[]` with an
//     `as`-asserted accumulator seed.
//  2. Run `check` with typescript/prefer-reduce-type-parameter enabled as
//     error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification An asserted reduce seed must report.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/prefer-reduce-type-parameter rendered error at line 7, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases Explicit accumulator type argument and unasserted seed stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPreferReduceTypeParameter invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusPreferReduceTypeParameter(t *testing.T) {
  root := seedLintProject(t, `declare const list: number[];
const collected = list.reduce(
  (acc, value) => {
    acc.push(String(value));
    return acc;
  },
  [] as string[],
);
JSON.stringify(collected);
`)
  seedLintRules(t, root, map[string]string{"typescript/prefer-reduce-type-parameter": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/prefer-reduce-type-parameter]") {
    t.Fatalf("prefer-reduce-type-parameter diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/prefer-reduce-type-parameter", stderr, 7)
  assertTypedRuleCleanSource(t, "typescript/prefer-reduce-type-parameter", "declare const list: number[];\nconst collected = list.reduce<string[]>((acc, value) => { acc.push(String(value)); return acc; }, []);\n")
}
