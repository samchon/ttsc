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
func TestNextjsNoAssignModuleVariableReportsShadow(t *testing.T) {
  assertRuleCorpusCase(t, "pages/index.ts", `
// expect: nextjs/no-assign-module-variable error
const module = {};
export default module;
`)
}
