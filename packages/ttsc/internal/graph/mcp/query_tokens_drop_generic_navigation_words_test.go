package mcp

import (
  "reflect"
  "testing"
)

// TestQueryTokensDropGenericNavigationWords verifies natural-language graph
// queries keep domain anchors instead of generic navigation words.
//
// Broad code-flow questions often contain words such as "code", "method",
// "request", or "main" that match high-degree symbols and make query_nodes
// expensive before it is useful. This pins the tokenizer so prompt guidance can
// ask for concise domain nouns without those generic terms dominating ranking.
//
//  1. Tokenize a typical benchmark-style question with generic navigation words.
//  2. Assert only the domain anchors remain for graph matching.
func TestQueryTokensDropGenericNavigationWords(t *testing.T) {
  got := queryTokens("Which code path invokes the selected RouterExecutionContext method for an HTTP route request?")
  want := []string{"routerexecutioncontext", "http", "route"}
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("queryTokens() = %#v; want %#v", got, want)
  }

  got = queryTokens("How are relation options applied when repository.find() builds its query?")
  want = []string{"relation", "repository", "find"}
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("queryTokens() = %#v; want %#v", got, want)
  }
}

func TestQueryWordsKeepCamelCaseParts(t *testing.T) {
  got := queryWords("SelectQueryBuilder joinAttributes relationPropertyPath")
  for _, want := range []string{
    "selectquerybuilder",
    "joinattributes",
    "join",
    "attributes",
    "relationpropertypath",
    "relation",
    "property",
    "path",
  } {
    if !got[want] {
      t.Fatalf("queryWords() did not keep %q in %#v", want, got)
    }
  }
  for _, noise := range []string{
    "select",
    "query",
    "builder",
  } {
    if got[noise] {
      t.Fatalf("queryWords() split PascalCase owner word %q into %#v", noise, got)
    }
  }
}
