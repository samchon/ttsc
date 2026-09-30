package evidence

import (
  "encoding/json"
  "strings"
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies documented configuration failures are emitted once per graph cycle.
 *
 * File rules run in parallel and decode the same global option once per source
 * file. The graph project state is the cycle-scoped rendezvous available to
 * contributors, so one state must deduplicate peers while a fresh watch cycle
 * must be able to report the same still-invalid option again.
 *
 *  1. Check two files against one invalid option and one cycle state.
 *  2. Repeat with a fresh cycle state.
 *  3. Assert each cycle reports exactly once and the later cycle recovers.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification documentedRule.Check with cycle-scoped project results exercises this case: Verifies documented configuration failures are emitted once per graph cycle. The original assertions check assert each cycle reports exactly once and the later cycle recovers.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations File rules run in parallel and decode the same global option once per source file. The graph project state is the cycle-scoped rendezvous available to contributors, so one state must deduplicate peers while a fresh watch cycle must be able to report the same still-invalid option again. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Check two files against one invalid option and one cycle state. Repeat with a fresh cycle state. Assert each cycle reports exactly once and the later cycle recovers. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedConfigurationReportsOnceAndRecoversNextCycle is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises documentedRule.Check with cycle-scoped project results within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedConfigurationReportsOnceAndRecoversNextCycle(t *testing.T) {
  runCycle := func(state *graphCycleState, options string) []string {
    messages := []string{}
    for _, name := range []string{"alpha.ts", "beta.ts"} {
      file := parseTestSourceFile(
        t,
        "src/"+name,
        "/** Documented. */\nexport interface Contract {}\n",
      )
      reporter := &capturedFileReporter{}
      documentedRule{}.Check(
        rule.NewContextWithProjectResults(
          file,
          nil,
          rule.SeverityError,
          json.RawMessage(options),
          reporter,
          documentedCycleResults{state: state},
        ),
        file.AsNode(),
      )
      messages = append(messages, reporter.messages...)
    }
    return messages
  }

  first := runCycle(&graphCycleState{}, `{"symbols":"type"}`)
  assertReported(t, first, "Invalid evidence/documented configuration")
  second := runCycle(&graphCycleState{}, `{"symbols":"type"}`)
  assertReported(t, second, "Invalid evidence/documented configuration")
  repaired := runCycle(&graphCycleState{}, `{"symbol":"type"}`)
  if countProblemsContaining(repaired, "Invalid evidence/documented configuration") != 0 {
    t.Fatalf("a repaired later cycle retained the invalid finding:\n%s", strings.Join(repaired, "\n"))
  }
}
