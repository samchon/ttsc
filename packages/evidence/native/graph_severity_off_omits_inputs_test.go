package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies off populations leave no watched inputs but still validate options.
 *
 * Keeping an off reference in the input graph would trigger rebuilds for work
 * the consumer explicitly staged. Invalid options still need a repair before
 * that entry can safely be re-enabled.
 *
 * 1. Disable a claim and one reference of an enabled claim.
 * 2. Assert only the enabled reference is watched.
 * 3. Assert an invalid severity in an off claim is still rejected.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification decodeGraphConfig and graphProjectInputs exercises this case: Verifies off populations leave no watched inputs but still validate options. The original assertions check assert an invalid severity in an off claim is still rejected.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Keeping an off reference in the input graph would trigger rebuilds for work the consumer explicitly staged. Invalid options still need a repair before that entry can safely be re-enabled. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Disable a claim and one reference of an enabled claim. Assert only the enabled reference is watched. Assert an invalid severity in an off claim is still rejected. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphSeverityOffOmitsInputs is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises decodeGraphConfig and graphProjectInputs within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphSeverityOffOmitsInputs(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[
    {"type":"markdown","files":["staged/**"],"severity":"off","reference":{"type":"markdown","files":["staged-evidence/**"],"severity":"error"}},
    {"type":"typescript","files":["src/**"],"reference":[
      {"type":"markdown","files":["off/**"],"severity":0},
      {"type":"markdown","files":["live/**"],"severity":"warning"}
    ]}
  ]}`))
  assertNoProblems(t, problems)
  inputs := graphProjectInputs(config)
  if len(inputs) != 1 || inputs[0].Pattern != "live/**" {
    t.Fatalf("off populations leaked inputs: %#v", inputs)
  }
  _, problems = decodeGraphConfig(json.RawMessage(`{"claims":[{"type":"typescript","files":["src/**"],"severity":"off","reference":{"type":"markdown","files":["docs/**"],"severity":null}}]}`))
  if len(problems) != 1 || !strings.Contains(problems[0], "claims[0].reference.severity") {
    t.Fatalf("off claim hid malformed severity: %v", problems)
  }
}
