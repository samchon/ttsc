package mcp

import "testing"

// TestDottedSymbolScoringUsesExactMembers verifies owner-member boosts stay
// tied to graph symbol names, not hidden vocabulary or camel-case tokenization.
//
// The matcher may compare query text to existing node names, including substring
// checks, but it must not split identifiers into inferred semantic words and then
// pretend those words were indexed symbols.
//
//  1. Score a neutral workflow query against requested and sibling methods.
//  2. Assert exact owner/member evidence gets the dotted boost.
//  3. Assert separate words do not trigger the exact dotted boost for a compound
//     member name.
func TestDottedSymbolScoringUsesExactMembers(t *testing.T) {
  flowWords := queryWords("Gateway fetch Coordinator fetch Pipeline setPlan applyPlan buildSteps plan steps")
  gatewayFetch := naturalDottedScore("Gateway.fetch", flowWords)
  gatewayCreateSession := naturalDottedScore("Gateway.createSession", flowWords)
  if gatewayFetch <= gatewayCreateSession {
    t.Fatalf("Gateway.fetch should outrank Gateway.createSession: fetch=%d createSession=%d", gatewayFetch, gatewayCreateSession)
  }
  coordinatorFetch := naturalDottedScore("Coordinator.fetch", flowWords)
  coordinatorCreateSession := naturalDottedScore("Coordinator.createSession", flowWords)
  if coordinatorFetch <= coordinatorCreateSession {
    t.Fatalf("Coordinator.fetch should outrank Coordinator.createSession: fetch=%d createSession=%d", coordinatorFetch, coordinatorCreateSession)
  }
  if naturalDottedScore("Pipeline.setPlan", flowWords) == 0 {
    t.Fatal("exact member token setPlan should remain a dotted-symbol match")
  }

  splitWords := queryWords("Pipeline set plan")
  if naturalDottedScore("Pipeline.setPlan", splitWords) != 0 {
    t.Fatal("separate query words must not camel-split a compound member into an exact dotted boost")
  }

  typoOwnerWords := queryWords("pipeleine setPlan applyPlan buildSteps steps")
  if exactMemberScore("Pipeline.setPlan", typoOwnerWords) == 0 ||
    exactMemberScore("Pipeline.applyPlan", typoOwnerWords) == 0 ||
    exactMemberScore("Pipeline.buildSteps", typoOwnerWords) == 0 {
    t.Fatal("exact member names should rank even when the owner token is misspelled")
  }
}
