package linthost

import "testing"

// TestBanTsCommentOptionDescriptionFormatAcceptsMatchingDescription verifies
// the `{ descriptionFormat }` option accepts a conforming description.
//
// The object form both requires a description and matches it against the
// configured pattern (upstream's canonical `^: TS\d+ because .+$`). A
// directive whose description satisfies both gates — in a line comment and
// on a block comment's last line — must stay silent.
//
// 1. Configure the canonical format with a 10-character minimum.
// 2. Lint conforming line- and block-comment directives.
// 3. Assert zero findings for both.
func TestBanTsCommentOptionDescriptionFormatAcceptsMatchingDescription(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  const options = `{"minimumDescriptionLength": 10, "ts-expect-error": {"descriptionFormat": "^: TS\\d+ because .+$"}}`
  assertRuleSkipsSourceWithOptions(
    t,
    ruleName,
    "// @ts-expect-error: TS1234 because xyz\nconst a: number = 1;\nJSON.stringify(a);\n",
    options,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    ruleName,
    "/*\n * @ts-expect-error: TS1234 because xyz */\nconst a: number = 1;\nJSON.stringify(a);\n",
    options,
  )
}
