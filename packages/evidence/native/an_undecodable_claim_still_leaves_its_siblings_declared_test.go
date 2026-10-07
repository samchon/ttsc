package evidence

import (
  "github.com/samchon/ttsc/packages/lint/rule"
  "testing"
)

/**
 * Verifies a broken claim neither panics nor silences its healthy siblings.
 *
 * The host runs this contract behind a recover that turns a panic into a
 * snapshot-wide error (`callProjectInputs` and `collectProjectInputs` in
 * `linthost/project_inputs.go`), so one malformed
 * claim must not be able to un-watch a whole project. Declaring what decoded is
 * also the behavior an author needs most while a configuration is mid-repair.
 *
 *  1. Configure one claim with an unsupported artifact type and one valid claim.
 *  2. Publish the rule's project inputs.
 *  3. Assert the valid claim's glob is declared and nothing panicked.
 *
 * @evidence contracts/testing.md#behavioral-verification declaredInputs calls graphRule.ProjectInputs on a configuration holding one claim of the unsupported type `nonsense` (with a Markdown reference over never/**) and one valid TypeScript claim whose Markdown reference selects docs/spec/**\/*.md; assertDeclares requires the glob inputs to be exactly docs/spec/**\/*.md.
 * @evidence contracts/testing.md#independent-expectations The expected single glob is authored: the valid claim's reference population must still be declared, and nothing from the undecodable claim (docs/** or never/**) may be declared; a panic in the input declaration would fail the test.
 * @evidence contracts/testing.md#distinguishing-cases One broken claim beside one healthy sibling; the exact-set check separates silencing the healthy claim (empty set) from declaring the broken claim's globs (extra patterns). Fully valid configurations are owned by sibling input entries.
 * @evidence contracts/testing.md#execution-ownership TestAnUndecodableClaimStillLeavesItsSiblingsDeclared is a Go unit entry in the native test process; it calls ProjectInputs on an in-memory project input context with no sources, consumer install or product host.
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
