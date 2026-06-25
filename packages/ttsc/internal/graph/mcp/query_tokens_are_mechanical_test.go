package mcp

import (
  "reflect"
  "testing"
)

// TestQueryTokensAreMechanical verifies query tokenization does not carry a
// semantic stop-word or project-term list.
//
// query_nodes is an index over graph names and relationships. Tokenization
// should therefore preserve what the user wrote after lowercasing and delimiter
// splitting, leaving relevance decisions to graph scoring rather than a hidden
// vocabulary.
//
//  1. Tokenize a natural-language question that includes generic words.
//  2. Assert the generic words remain ordinary tokens.
//  3. Assert single-character fragments are still dropped as non-identifiers.
func TestQueryTokensAreMechanical(t *testing.T) {
  got := queryTokens("Which code path invokes the selected RouterExecutionContext method for an HTTP route request?")
  want := []string{"which", "code", "path", "invokes", "the", "selected", "routerexecutioncontext", "method", "for", "an", "http", "route", "request"}
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("queryTokens() = %#v; want %#v", got, want)
  }

  got = queryTokens("x.y z")
  want = []string{}
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("queryTokens() = %#v; want %#v", got, want)
  }
}

func TestQueryWordsPreserveCompoundIdentifiers(t *testing.T) {
  got := queryWords("Worker.applyPlan applyPlan BuildTaskQueue")
  for _, want := range []string{
    "worker",
    "applyplan",
    "buildtaskqueue",
  } {
    if !got[want] {
      t.Fatalf("queryWords() did not keep %q in %#v", want, got)
    }
  }
  for _, split := range []string{
    "apply",
    "plan",
    "build",
    "task",
    "queue",
  } {
    if got[split] {
      t.Fatalf("queryWords() split compound identifier word %q into %#v", split, got)
    }
  }
}
