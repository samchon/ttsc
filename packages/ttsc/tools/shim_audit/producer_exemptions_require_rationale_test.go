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
  surface := newProducerSurface()
  surface.add(flowConsume, flowType{pkg: "fixture", name: "Root"}, "fixture.UseRoot")
  functionGap := finding{kind: "FUNC", pkg: "fixture", symbol: "Reachable"}

  absentProducer := evaluateProducerSurface(surface, nil)
  absent := evaluateBaseline(append(absentProducer.gaps, functionGap), baselineFile{}, absentProducer.usedRoots)
  if len(absent.producerGaps) != 1 || len(absent.newGaps) != 1 {
    t.Fatalf("absent exemption evaluation = %+v", absent)
  }

  emptyBaseline := baselineFile{
    ProducerExemptions: map[string]string{"fixture.Root": "  "},
  }
  emptyProducer := evaluateProducerSurface(surface, emptyBaseline.ProducerExemptions)
  empty := evaluateBaseline(append(emptyProducer.gaps, functionGap), emptyBaseline, emptyProducer.usedRoots)
  if len(empty.producerGaps) != 1 || len(empty.invalidReasons) != 1 {
    t.Fatalf("empty exemption evaluation = %+v", empty)
  }

  reasonedBaseline := baselineFile{
    Accepted:           []string{"FUNC|fixture|Reachable"},
    ProducerExemptions: map[string]string{"fixture.Root": "Caller-owned configuration object."},
  }
  reasonedProducer := evaluateProducerSurface(surface, reasonedBaseline.ProducerExemptions)
  reasoned := evaluateBaseline(append(reasonedProducer.gaps, functionGap), reasonedBaseline, reasonedProducer.usedRoots)
  if len(reasoned.producerGaps) != 0 || len(reasoned.newGaps) != 0 || len(reasoned.invalidReasons) != 0 {
    t.Fatalf("reasoned exemption evaluation = %+v", reasoned)
  }
}
