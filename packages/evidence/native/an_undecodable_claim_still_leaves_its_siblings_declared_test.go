package evidence

import (
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies a broken claim neither panics nor silences its healthy siblings.
 *
 * The host runs this contract behind a recover that turns a panic into a
 * snapshot-wide error (`linthost/project_inputs.go:139-149`), so one malformed
 * claim must not be able to un-watch a whole project. Declaring what decoded is
 * also the behavior an author needs most while a configuration is mid-repair.
 *
 *  1. Configure one claim with an unsupported artifact type and one valid claim.
 *  2. Publish the rule's project inputs.
 *  3. Assert the valid claim's glob is declared and nothing panicked.
 * @evidence contracts/testing.md#behavioral-verification graphRule.ProjectInputs through declaredInputs is exercised with the scenario below; the assertions require the valid claim's glob is declared and nothing panicked.
 * @evidence contracts/testing.md#independent-expectations The host runs this contract behind a recover that turns a panic into a snapshot-wide error (`linthost/project_inputs.go:139-149`), so one malformed claim must not be able to un-watch a whole project. Declaring what decoded is also the behavior an author needs most while a configuration is mid-repair.
 * @evidence contracts/testing.md#distinguishing-cases Configure one claim with an unsupported artifact type and one valid claim. Publish the rule's project inputs. Assert the valid claim's glob is declared and nothing panicked.
 * @evidence contracts/testing.md#execution-ownership TestAnUndecodableClaimStillLeavesItsSiblingsDeclared is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestAnUndecodableClaimStillLeavesItsSiblingsDeclared(t *testing.T) {
  inputs := declaredInputs(t, `{"claims":[
    {"type":"nonsense","files":["docs/**"],"reference":{"type":"markdown","files":["never/**"]}},
    {
      "type":"typescript",
      "files":["src/**"],
      "reference":{"type":"markdown","files":["docs/spec/**/*.md"],"symbol":"h2"}
    }
  ]}`)
  assertDeclares(t, inputs, rule.ProjectInputGlob, []string{"docs/spec/**/*.md"})
}
