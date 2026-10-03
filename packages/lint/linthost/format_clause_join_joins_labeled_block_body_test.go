package linthost

import "testing"

// TestFormatClauseJoinJoinsLabeledBlockBody verifies a labeled statement joins its body even when that body is a block.
//
// The labeled-statement target sets alwaysJoin, allowing both a multiline loop
// and an actual Block body past the ordinary block and single-line guards.
// These two snapshots require the label gap to join without changing the body;
// they do not observe later format passes or external formatter output.
//
//  1. Parse labels controlling a multiline loop and an actual block.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert each body joins its label line and its interior is untouched.
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must attach both a multiline for-of statement and an actual block to outer:. Complete literal outputs detect applying ordinary block or multiline exclusions to labeled statements while preserving the bodies.
// @evidence contracts/testing.md#independent-expectations Independent literal outputs follow the supported label policy with label: statement on the same line, including label: {. Expected loop, break and run tokens are unchanged content; this body does not obtain external formatter output.
// @evidence contracts/testing.md#distinguishing-cases The original loop-with-braces input is retained and a direct Block body is added to distinguish the actual Block exception. Both bodies start at the label column; the reindent host covers indented bodies.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinJoinsLabeledBlockBody owns both literal label fixtures in the public Go unit population. The owning syntax-only rule and edit application run in process without a consumer install, native product build or actual product host.
func TestFormatClauseJoinJoinsLabeledBlockBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "outer:\nfor (const item of items) {\n  break outer;\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "outer: for (const item of items) {\n  break outer;\n}\n",
  )
  assertFixSnapshotWithOptions(t, "format/clause-join",
    "outer:\n{\n  run();\n}\n", `{"printWidth":80,"tabWidth":2}`,
    "outer: {\n  run();\n}\n")
}
