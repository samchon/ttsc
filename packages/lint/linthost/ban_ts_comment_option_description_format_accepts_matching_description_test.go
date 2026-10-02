package linthost

import "testing"

// TestBanTsCommentOptionDescriptionFormatAcceptsMatchingDescription verifies
// the `{ descriptionFormat }` option accepts a conforming description.
//
// The object form both requires a description and matches it against the
// configured pattern (upstream's canonical `^: TS\d+ because .+$`). A
// directive whose description satisfies both gates in a line comment and
// on a block comment's last line must stay silent.
//
// 1. Configure the canonical format with a 10-character minimum.
// 2. Lint conforming line- and block-comment directives.
// 3. Assert zero findings for both.
//
// @evidence contracts/testing.md#behavioral-verification A configured description regex and minimum length accept conforming line and final-line block directives.
// @evidence contracts/testing.md#independent-expectations The literal : TS1234 because xyz description meets both authored gates; zero findings follows regex/length meaning independently.
// @evidence contracts/testing.md#distinguishing-cases Line and block forms complement the format-mismatch and length-precedence siblings.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSourceWithOptions executes both sources using the exact option string; this entry owns both allowances. No consumer install or native product-host build/launch is used.
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
