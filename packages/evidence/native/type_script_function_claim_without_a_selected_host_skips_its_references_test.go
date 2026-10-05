package evidence

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * TestTypeScriptFunctionClaimWithoutASelectedHostSkipsItsReferences verifies
 * function selection controls reference loading for a matched TypeScript file.
 *
 * A data export is not a function host. Adding a function must activate the
 * same missing reference, so a permanently disabled claim cannot pass.
 *
 *  1. Match the consumer's data-only source under its function claim.
 *  2. Require a clean whole-rule result despite its missing Markdown root.
 *  3. Add one exported function and require that exact missing root to fail.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual graphRule.Check path receives the same claim and src/claim.ts through runIndexRuleAtSeverity; data-only input has no messages and failed=false, while adding a function sets failed=true and names missing-typescript-docs.
 * @evidence contracts/testing.md#independent-expectations A variable with a numeric initializer is not a function; an exported function activates its configured reference. Literal clean and named missing-root expectations distinguish activation from silence rather than copying a previous result.
 * @evidence contracts/testing.md#distinguishing-cases The exact value-only consumer input and its one-function contrast share file selection and reference configuration; both captured failure state and diagnostic content are asserted. Artifact-host activation belongs to the existing real Prisma bridge cases.
 * @evidence contracts/testing.md#execution-ownership A selectable native Go unit calls the owning project rule with actual parsed TypeScript and temporary resolver files. No consumer installation, native artifact, Node bridge or product host runs.
 */
func TestTypeScriptFunctionClaimWithoutASelectedHostSkipsItsReferences(t *testing.T) {
  const config = `{"claims":[{
		"type":"typescript",
		"files":["src/**/*.ts"],
		"symbol":"function",
		"reference":{"type":"markdown","root":"missing-typescript-docs","files":["**/*.md"],"symbol":"h2"}
	}]}`
  for _, scenario := range []struct {
    name   string
    source string
    active bool
  }{
    {"data-only", "export const value = 1;\n", false},
    {"function-added", "export const value = 1;\nexport function selected(): void {}\n", true},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      result := runIndexRuleAtSeverity(t, t.TempDir(), map[string]string{
        "src/claim.ts": scenario.source,
      }, config, rule.SeverityError)
      if result.failed != scenario.active {
        t.Errorf("active=%v must produce failed=%v, got %v: %v", scenario.active, scenario.active, result.failed, result.messages)
      }
      if scenario.active {
        assertProblemContains(t, result.messages, "missing-typescript-docs")
      } else {
        assertNoProblems(t, result.messages)
      }
    })
  }
}
