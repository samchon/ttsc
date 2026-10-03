package linthost

import (
  "strings"
  "testing"
)

// TestRequiredBehavioralWitnessKindsIgnoreNonPublicCandidates keeps a test-only
// platform record from satisfying the public prerequisite requirement.
//
//
//  1. Supply five public prerequisite kinds and a test-only platform record.
//  2. Require missing-platform rejection until a public platform record completes the required set.
//
// @evidence contracts/testing.md#behavioral-verification A platform witness outside the supplied public set leaves the platform prerequisite missing; adding an otherwise identical public platform route then satisfies all required kinds.
// @evidence contracts/testing.md#independent-expectations Required-kind coverage is contributed only by public identities. Five authored public kinds plus one test-only platform must fail, while six public kinds must pass independently of registry or file counts.
// @evidence contracts/testing.md#distinguishing-cases The original nonpublic platform record remains present in both controls; changing only public admission of the additional platform identity distinguishes filtering from unconditional acceptance or rejection.
// @evidence contracts/testing.md#execution-ownership Direct prerequisite-validator calls run on authored maps in the Go process. These candidate records test auditor accounting and do not claim production execution, filesystem existence, installation or native compilation.
func TestRequiredBehavioralWitnessKindsIgnoreNonPublicCandidates(t *testing.T) {
  public := map[string]struct{}{
    "fixture/engine":   {},
    "fixture/options":  {},
    "fixture/filename": {},
    "fixture/project":  {},
    "fixture/checker":  {},
  }
  candidates := map[string][]behavioralWitness{}
  for ruleName, kind := range map[string]behavioralWitnessKind{
    "fixture/engine":   behavioralWitnessEngine,
    "fixture/options":  behavioralWitnessOptions,
    "fixture/filename": behavioralWitnessFilename,
    "fixture/project":  behavioralWitnessProject,
    "fixture/checker":  behavioralWitnessChecker,
    "test/platform":    behavioralWitnessPlatform,
  } {
    candidates[ruleName] = []behavioralWitness{{
      Rule:    ruleName,
      Route:   "Test" + string(kind),
      Kind:    kind,
      Sources: []string{"fixture_test.go"},
    }}
  }
  err := verifyRequiredBehavioralWitnessKinds(public, candidates)
  if err == nil || !strings.Contains(err.Error(), string(behavioralWitnessPlatform)) {
    t.Fatalf("non-public platform candidate satisfied the public kind audit: %v", err)
  }
  public["fixture/platform"] = struct{}{}
  candidates["fixture/platform"] = []behavioralWitness{{Rule: "fixture/platform", Route: "Testplatform", Kind: behavioralWitnessPlatform, Sources: []string{"fixture_test.go"}}}
  if err := verifyRequiredBehavioralWitnessKinds(public, candidates); err != nil { t.Fatalf("complete public prerequisite set rejected: %v", err) }
}
