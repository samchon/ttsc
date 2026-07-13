package linthost

import "testing"

// TestBanTsCommentFixRewritesManySlashLineComment verifies directive
// matching and the autofix on a line comment with extra leading slashes.
//
// The compiler's error-suppression regex accepts any number of slashes
// before `@ts-ignore` (unlike the 2-3 slash pragma rule), and upstream's
// suggestion output for `/////@ts-ignore: Suppress next line` swaps only
// the directive token. Both the match and the surgical edit are pinned.
//
// 1. Materialize a file led by `/////@ts-ignore: Suppress next line`.
// 2. Run the real fix applier over the rule's findings.
// 3. Assert the output equals upstream's suggestion output verbatim.
func TestBanTsCommentFixRewritesManySlashLineComment(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/ban-ts-comment",
    "/////@ts-ignore: Suppress next line\nconst a: number = 1;\nJSON.stringify(a);\n",
    "/////@ts-expect-error: Suppress next line\nconst a: number = 1;\nJSON.stringify(a);\n",
  )
}
