package linthost

import "testing"

// TestBanTsCommentDefaultDoesNotFixTsIgnore verifies `ttsc fix` leaves the
// upstream opt-in replacement out of the automatic edit channel.
//
// Replacing an `@ts-ignore` above an error-free line creates TS2578, so the
// diagnostic must remain while automatic fix application leaves source intact.
//
// 1. Materialize a file whose first line is `// @ts-ignore: Suppress next line`.
// 2. Run the real fix applier over the rule's findings.
// 3. Assert no automatic edit is applied.
func TestBanTsCommentDefaultDoesNotFixTsIgnore(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "typescript/ban-ts-comment",
    "// @ts-ignore: Suppress next line\nconst a: number = 1;\nJSON.stringify(a);\n",
  )
}
