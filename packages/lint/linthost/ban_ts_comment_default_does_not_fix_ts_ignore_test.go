package linthost

import "testing"

// TestBanTsCommentDefaultDoesNotFixTsIgnore verifies the owning finding fixer
// applies no automatic source edit for the authored ignore directive.
//
// Replacing an `@ts-ignore` above an error-free line creates TS2578, so the
// diagnostic must remain while automatic fix application leaves source intact.
//
// 1. Materialize a file whose first line is `// @ts-ignore: Suppress next line`.
// 2. Run the real fix applier over the rule's findings.
// 3. Assert no automatic edit is applied.
//
// @evidence contracts/testing.md#behavioral-verification The actual finding fixer applies zero edits and preserves the authored error-free source; it does not silently replace ignore with expect-error. Direct suggestion-channel assertions belong to ReportsIgnoreWithUpgradeMessage.
// @evidence contracts/testing.md#independent-expectations Replacing ignore with expect-error may create TS2578 on an error-free line, so only an explicit suggestion is appropriate.
// @evidence contracts/testing.md#distinguishing-cases The authored error-free number assignment pins automatic-fix absence; the compiler-boundary and suggestion tests own actual rewrites.
// @evidence contracts/testing.md#execution-ownership assertNoFixSnapshot obtains validated active-rule findings, calls the disk-backed finding fixer and checks zero applied edits and unchanged bytes; this Test owns that result without invoking the fix CLI. No consumer install or native product-host build/launch is used.
func TestBanTsCommentDefaultDoesNotFixTsIgnore(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "typescript/ban-ts-comment",
    "// @ts-ignore: Suppress next line\nconst a: number = 1;\nJSON.stringify(a);\n",
  )
}
