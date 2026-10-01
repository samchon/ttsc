package linthost

import "testing"

// TestNextjsNoAssignModuleVariableReportsShadow verifies `module` variable declarations are rejected.
//
// Next.js reserves `module` in compiled output, so a local declaration should be
// flagged without needing JSX or project context.
//
// 1. Parse a TypeScript module declaring `module`.
// 2. Enable `nextjs/no-assign-module-variable`.
// 3. Assert the declaration is reported.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies local module declaration is reported for nextjs/no-assign-module-variable; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations Next reserves module in compiled output; another identifier avoids the reserved binding. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/index.ts. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoAssignModuleVariableReportsShadow is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoAssignModuleVariableReportsShadow(t *testing.T) {
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-assign-module-variable", "pages/index.ts", "const localModule = {}; export default localModule;\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
