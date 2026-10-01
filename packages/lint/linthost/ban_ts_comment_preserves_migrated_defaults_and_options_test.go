package linthost

import (
  "encoding/json"
  "testing"
)

// TestBanTsCommentPreservesMigratedDefaultsAndOptions verifies both original
// directive policies, description constraints and regex matching.
//
// The default and configured policies must stay distinct rather than
// silently dropping tuple options while crossing the command boundary.
//
// 1. Run the defaults fixture and compare the one nocheck diagnostic.
// 2. Run the configured fixture and compare every option-arm diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification The owning Go command loads both original JSON settings and compares complete rule, severity and line sets, exposing ignored options and false reports on permitted directives.
// @evidence contracts/testing.md#independent-expectations Defaults line 1 and configured lines 1, 2 and 6 follow the authored directive policy: forbidden check, too-short nocheck description and mismatched expect-error format. The accepted TS2322 description establishes the independent regex control.
// @evidence contracts/testing.md#distinguishing-cases Defaults allow described expect-error and reject nocheck; configured minimum length 10, enabled check, description-required nocheck, disabled ignore and regex-constrained expect-error retain every original option arm.
// @evidence contracts/testing.md#execution-ownership TestBanTsCommentPreservesMigratedDefaultsAndOptions owns both variants through assertMigratedTypedRuleCase in the same Go unit process. No consumer install or native build is performed; package discovery and native transport remain in the shared E2E survivor.
func TestBanTsCommentPreservesMigratedDefaultsAndOptions(t *testing.T) {
  const config = "{\"compilerOptions\":{\"target\":\"ES2022\",\"module\":\"NodeNext\",\"moduleResolution\":\"NodeNext\",\"strict\":true,\"noEmit\":true,\"rootDir\":\"src\"},\"include\":[\"src\"]}"
  assertMigratedTypedRuleCase(t, "// @ts-nocheck\nconst unchecked: string = 1;\n// @ts-expect-error: intentional mismatch\nconst described: string = 1;\n", config, "{\"private\":true,\"type\":\"module\",\"dependencies\":{\"@ttsc/lint\":\"*\"}}", "typescript/ban-ts-comment", "error", []ruleExpectation{{Rule: "typescript/ban-ts-comment", Severity: SeverityError, Line: 1}})
  var options map[string]any
  if err := json.Unmarshal([]byte("{\"minimumDescriptionLength\":10,\"ts-check\":true,\"ts-nocheck\":\"allow-with-description\",\"ts-ignore\":false,\"ts-expect-error\":{\"descriptionFormat\":\"^: TS\\\\d+ because .+$\"}}"), &options); err != nil { t.Fatal(err) }
  assertMigratedTypedRuleCase(t, "// @ts-check\n// @ts-nocheck: short\nconst marker = 1;\n// @ts-expect-error: TS2322 because assignment is intentionally invalid\nconst described: string = 1;\n// @ts-expect-error: wrong format but long enough\nconst malformed: string = 1;\n// @ts-ignore\nconst ignored: string = 1;\nvoid marker;\n", config, "{\"private\":true,\"type\":\"module\",\"dependencies\":{\"@ttsc/lint\":\"*\"}}", "typescript/ban-ts-comment", []any{"error", options}, []ruleExpectation{{Rule: "typescript/ban-ts-comment", Severity: SeverityError, Line: 1}, {Rule: "typescript/ban-ts-comment", Severity: SeverityError, Line: 2}, {Rule: "typescript/ban-ts-comment", Severity: SeverityError, Line: 6}})
}
