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
 * @evidence contracts/testing.md#behavioral-verification documentedRule.Check is run over two files per cycle through rule.NewContextWithProjectResults with a graphCycleState; with the misspelled option `{"symbols":"type"}` the first cycle and a second fresh cycle must each report exactly one `Invalid evidence/documented configuration` diagnostic across both files, and a third fresh cycle with the corrected option `{"symbol":"type"}` must report none.
 * @evidence contracts/testing.md#independent-expectations The expected counts are authored from the cycle contract: one cycle state deduplicates the configuration failure across parallel file checks, while a new state (a later watch cycle) must report a still-invalid option again and stop reporting once it is repaired.
 * @evidence contracts/testing.md#distinguishing-cases Two files under one state (exactly-once rather than twice), a second fresh state (not suppressed forever), and a repaired option (recovers); the local runCycle closure drives all three.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedConfigurationReportsOnceAndRecoversNextCycle is a Go unit entry in the native test process; it calls documentedRule.Check directly on in-memory parsed files with a cycle-results stub, with no consumer install, LSP or product host.
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
