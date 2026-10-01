package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies a checklist is refused beside each cardinality option it contradicts.
 *
 * These are unsatisfiable rather than merely redundant: a checklist wants every host to cite every unit, which `uniqueEvidence` forbids the moment a claim has two hosts and `singleEvidencePerSymbol` forbids the moment the population has two units. Reporting at decode matters because a one-host, one-unit graph satisfies all three by accident and would ship the contradiction until the second file arrived.
 *
 *  1. Pair the checklist with each cardinality option and with both at once.
 *  2. Decode each graph, disabled and enabled alike.
 *  3. Assert each contradiction is named on its own and both are named together.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts enabled and disabled claims both report a contradiction; the final disabled-claim result names each option and both together without reporting an absent option.
 *
 * @evidence contracts/testing.md#independent-expectations The documented per-host/per-item checklist obligation contradicts uniqueEvidence and singleEvidencePerSymbol. Each enabled/disabled claim must yield a problem; the helper returns only the disabled=true diagnostics for the precise contradiction and absent-option assertions, so exact enabled-claim diagnostic attribution remains unasserted.
 *
 * @evidence contracts/testing.md#distinguishing-cases Enabled and disabled claims both report a contradiction; the final disabled-claim result names each option and both together without reporting an absent option.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticChecklistIsRefusedBesideTheCardinalityOptions is the selectable unit entry in packages/evidence/native, compiled beside its owning implementation in the shared Go unit process. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticChecklistIsRefusedBesideTheCardinalityOptions(t *testing.T) {
  decode := func(t *testing.T, options string) []string {
    t.Helper()
    collected := []string{}
    for _, disabled := range []string{"false", "true"} {
      _, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
        "type":"typescript",
        "disabled":` + disabled + `,
        "files":["src/**"],
        "reference":{
          "type":"markdown",
          "files":["docs/**"],
          "checklist":true,
          ` + options + `
        }
      }]}`))
      if len(problems) == 0 {
        t.Fatalf("disabled=%s accepted a contradictory policy", disabled)
      }
      collected = problems
    }
    return collected
  }

  unique := decode(t, `"uniqueEvidence":true`)
  assertProblemContains(t, unique, "checklist and uniqueEvidence cannot both hold")
  if strings.Contains(strings.Join(unique, "\n"), "singleEvidencePerSymbol cannot") {
    t.Fatalf("the unpaired option was reported:\n%s", strings.Join(unique, "\n"))
  }

  single := decode(t, `"singleEvidencePerSymbol":true`)
  assertProblemContains(t, single, "checklist and singleEvidencePerSymbol cannot both hold")
  if strings.Contains(strings.Join(single, "\n"), "uniqueEvidence cannot") {
    t.Fatalf("the unpaired option was reported:\n%s", strings.Join(single, "\n"))
  }

  both := decode(t, `"uniqueEvidence":true,"singleEvidencePerSymbol":true`)
  assertProblemContains(t, both, "checklist and uniqueEvidence cannot both hold")
  assertProblemContains(t, both, "checklist and singleEvidencePerSymbol cannot both hold")
}
