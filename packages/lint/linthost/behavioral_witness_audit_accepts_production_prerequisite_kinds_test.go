package linthost

import (
  "fmt"
  "testing"
)

// TestBehavioralWitnessAuditAcceptsProductionPrerequisiteKinds checks candidate
// validation and prerequisite accounting using authored auditor inputs. It does
// not execute production rules or claim that these fixture records observed a
// diagnostic; the semantic harnesses own those positive production observations.
//
//  1. Submit authored records for options, filename, project, checker and platform prerequisites.
//  2. Require one canonical route per public identity and accept the full kind set after adding engine.
//
// @evidence contracts/testing.md#behavioral-verification The auditor accepts one well-shaped candidate for each options, filename, project, checker and platform prerequisite, returns one record per public identity, and accepts the full required set after the engine kind is added.
// @evidence contracts/testing.md#independent-expectations The six supported prerequisite categories and one canonical record per public rule define auditor acceptance. Authored Rule, Route, Kind and Sources values are inputs to the decision, not evidence of production rule execution or existing files.
// @evidence contracts/testing.md#distinguishing-cases Five non-engine prerequisite records cover acceptance outside the flat engine lane; adding engine completes the six-kind requirement. The separate missing-platform unit rejects an incomplete public set.
// @evidence contracts/testing.md#execution-ownership Direct auditBehavioralWitnesses and verifyRequiredBehavioralWitnessKinds calls run in-process on synthetic maps. The unit owns coverage-validator behavior; source-name strings are validated record addresses without filesystem existence checks or product hosts.
func TestBehavioralWitnessAuditAcceptsProductionPrerequisiteKinds(t *testing.T) {
  kinds := []behavioralWitnessKind{
    behavioralWitnessOptions,
    behavioralWitnessFilename,
    behavioralWitnessProject,
    behavioralWitnessChecker,
    behavioralWitnessPlatform,
  }
  public := map[string]struct{}{}
  candidates := map[string][]behavioralWitness{}
  for index, kind := range kinds {
    ruleName := fmt.Sprintf("fixture/rule-%d", index)
    public[ruleName] = struct{}{}
    candidates[ruleName] = []behavioralWitness{{
      Rule:    ruleName,
      Route:   "Test" + string(kind),
      Kind:    kind,
      Sources: []string{"fixture_test.go"},
    }}
  }
  canonical, err := auditBehavioralWitnesses(public, candidates)
  if err != nil {
    t.Fatalf("valid prerequisite witness kinds were rejected: %v", err)
  }
  if len(canonical) != len(public) {
    t.Fatalf("canonical routes = %d, want %d: %+v", len(canonical), len(public), canonical)
  }
  public["fixture/engine"] = struct{}{}
  candidates["fixture/engine"] = []behavioralWitness{{
    Rule:    "fixture/engine",
    Route:   "Testengine",
    Kind:    behavioralWitnessEngine,
    Sources: []string{"fixture_test.go"},
  }}
  if err := verifyRequiredBehavioralWitnessKinds(public, candidates); err != nil {
    t.Fatalf("required prerequisite kinds were rejected: %v", err)
  }
}
