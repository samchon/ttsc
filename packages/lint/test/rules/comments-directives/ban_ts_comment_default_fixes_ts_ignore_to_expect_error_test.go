package linthost

import "testing"

// TestBanTsCommentDefaultFixesTsIgnoreToExpectError verifies the
// typescript/ban-ts-comment autofix rewrites `@ts-ignore` to `@ts-expect-error`.
//
// Under the default `ts-ignore: true` policy the rule attaches the upstream
// suggestion as an autofix. The rewrite must edit only the directive token
// and keep the trailing description, so `ttsc fix` upgrades the comment
// without touching the code it suppresses.
//
// 1. Materialize a file whose first line is `// @ts-ignore: Suppress next line`.
// 2. Run the real fix applier over the rule's findings.
// 3. Assert the rewritten source swaps in `@ts-expect-error` verbatim.
func TestBanTsCommentDefaultFixesTsIgnoreToExpectError(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/ban-ts-comment",
    "// @ts-ignore: Suppress next line\nconst a: number = 1;\nJSON.stringify(a);\n",
    "// @ts-expect-error: Suppress next line\nconst a: number = 1;\nJSON.stringify(a);\n",
  )
}
