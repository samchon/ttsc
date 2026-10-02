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
 *
 * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig and graphProjectInputs are called on a configuration with an `off` Markdown claim (whose reference is `error`), a reference with severity 0 and a live warning reference; the problems must be empty and the inputs exactly one pattern, `live/**`; a second configuration with an `off` claim whose reference has `severity: null` must yield exactly one problem naming `claims[0].reference.severity`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the staging contract: an off population must not be watched, but its options must still be validated so that re-enabling it is safe.
 * @evidence contracts/testing.md#distinguishing-cases An off claim and an off reference (both dropped from inputs) beside a live reference (kept), and a malformed severity inside an off claim (still rejected).
 * @evidence contracts/testing.md#execution-ownership TestGraphSeverityOffOmitsInputs is a Go unit entry in the native test process; it calls decodeGraphConfig and graphProjectInputs on in-memory JSON with no filesystem, consumer install or product host.
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
