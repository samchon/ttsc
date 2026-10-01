package linthost

import "testing"

// TestPreferAsConstPreservesMigratedAllFamilyContexts verifies the preserved rule-family diagnostic set.
//
// Separates the original consumer case's portable semantics from package
// discovery while retaining its exact source and compiler settings.
//
// 1. Materialize the original source and compiler configuration.
// 2. Run the owning command operation with the scalar rule setting.
// 3. Compare every diagnostic rule, severity and line and failure status.
//
// @evidence contracts/testing.md#behavioral-verification The command reports all four literal-type visitor forms including parenthesized types, while leaving auto-accessors and differently spelled literals clean.
// @evidence contracts/testing.md#independent-expectations Authored lines 1, 2, 3 and 5 designate raw-matching literal annotations; differently quoted strings and hexadecimal spelling independently establish the negative expectations.
// @evidence contracts/testing.md#distinguishing-cases As assertions, angle assertions, variable annotations and ordinary class properties report; the accessor, mismatched quotes and hexadecimal spelling remain clean.
// @evidence contracts/testing.md#execution-ownership TestPreferAsConstPreservesMigratedAllFamilyContexts executes through assertMigratedTypedRuleCase and the owning Go command in the shared lint unit process. Fixture files require no native build or consumer installation; package auto-discovery and native transport remain in the surviving E2E batch.
func TestPreferAsConstPreservesMigratedAllFamilyContexts(t *testing.T) {
  assertMigratedTypedRuleCase(t, "const asserted = \"asserted\" as (\"asserted\");\nconst angled = <(\"angled\")>\"angled\";\nlet variable: (\"variable\") = \"variable\";\nclass Holder {\n  public readonly property: (\"property\") = \"property\";\n  accessor tracked: (\"tracked\") = \"tracked\";\n}\nconst differentQuotes = 'different' as (\"different\");\nlet differentNumeric: (10) = 0xa;\n\nJSON.stringify(asserted, angled, variable, new Holder(), differentQuotes, differentNumeric);\n", "{\"compilerOptions\":{\"noEmit\":true,\"strict\":true,\"target\":\"ES2022\",\"module\":\"NodeNext\",\"moduleResolution\":\"NodeNext\"},\"files\":[\"src/main.ts\"]}", "{\"name\":\"prefer-as-const-no-plugins-entry-fixture\",\"private\":true,\"dependencies\":{\"@ttsc/lint\":\"*\"}}", "typescript/prefer-as-const", "error", []ruleExpectation{{Rule: "typescript/prefer-as-const", Severity: SeverityError, Line: 1}, {Rule: "typescript/prefer-as-const", Severity: SeverityError, Line: 2}, {Rule: "typescript/prefer-as-const", Severity: SeverityError, Line: 3}, {Rule: "typescript/prefer-as-const", Severity: SeverityError, Line: 5}})
}
