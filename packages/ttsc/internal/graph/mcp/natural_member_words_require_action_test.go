package mcp

import "testing"

// TestNaturalMemberWordsRequireAction verifies natural owner-member scoring is
// driven by explicit owner/member evidence rather than hidden vocabulary.
//
// The matcher may use identifier structure already present in graph node names,
// but it should not infer that generic words imply a specific helper prefix or
// project domain. Exact member queries still rank even when the owner token is
// misspelled because the member itself is a valid index key.
//
//  1. Score a neutral workflow query against requested and sibling methods.
//  2. Assert the requested member outranks a sibling whose action was not named.
//  3. Assert exact member names still rank when the owner token is misspelled.
func TestNaturalMemberWordsRequireAction(t *testing.T) {
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
    t.Fatal("exact member phrase setPlan should remain a natural match")
  }
  typoOwnerWords := queryWords("pipeleine setPlan applyPlan buildSteps steps")
  if exactMemberScore("Pipeline.setPlan", typoOwnerWords) == 0 ||
    exactMemberScore("Pipeline.applyPlan", typoOwnerWords) == 0 ||
    exactMemberScore("Pipeline.buildSteps", typoOwnerWords) == 0 {
    t.Fatal("exact member names should rank even when the owner token is misspelled")
  }

  getWords := queryWords("Coordinator get gateway")
  if naturalDottedScore("Coordinator.getGateway", getWords) == 0 {
    t.Fatal("explicit get gateway query should still match getGateway")
  }
}
