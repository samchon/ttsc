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
