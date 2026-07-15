package main

import "testing"

// Verifies producer exemptions require a non-empty rationale.
//
// Producer gaps use a separate zero-tolerance path so an ordinary accepted gap
// or an empty placeholder cannot silently classify compiler state as a root.
//
//  1. Evaluate the same producer gap with no exemption and an empty exemption.
//  2. Supply a reasoned public-root exemption and accept the unrelated function gap.
//  3. Confirm only the deliberate classification passes both gate classes.
func TestProducerExemptionsRequireRationale(t *testing.T) {
  findings := []finding{
    {kind: "PRODUCER", pkg: "fixture", symbol: "Root"},
    {kind: "FUNC", pkg: "fixture", symbol: "Reachable"},
  }
  absent := evaluateBaseline(findings, baselineFile{})
  if len(absent.producerGaps) != 1 || len(absent.newGaps) != 1 {
    t.Fatalf("absent exemption evaluation = %+v", absent)
  }

  empty := evaluateBaseline(findings, baselineFile{
    ProducerExemptions: map[string]string{"fixture.Root": "  "},
  })
  if len(empty.producerGaps) != 1 || len(empty.invalidReasons) != 1 {
    t.Fatalf("empty exemption evaluation = %+v", empty)
  }

  reasoned := evaluateBaseline(findings, baselineFile{
    Accepted:           []string{"FUNC|fixture|Reachable"},
    ProducerExemptions: map[string]string{"fixture.Root": "Caller-owned configuration object."},
  })
  if len(reasoned.producerGaps) != 0 || len(reasoned.newGaps) != 0 || len(reasoned.invalidReasons) != 0 {
    t.Fatalf("reasoned exemption evaluation = %+v", reasoned)
  }
}
