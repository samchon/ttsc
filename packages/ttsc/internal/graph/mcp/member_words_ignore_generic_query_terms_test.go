package mcp

import "testing"

// TestMemberWordsIgnoreGenericQueryTerms verifies natural owner-member matching
// does not promote generic navigation words as if they named the member.
//
// A question about how a repository find builds its query should still match a
// concrete `find` member and relation-domain names, but the generic words
// `query` and `options` must not pull sibling helpers such as `Repository.query`
// or `Repository.createQueryBuilder` into the top ranks.
//
//  1. Build the word set from a relation-style natural-language query.
//  2. Assert domain/member anchors remain.
//  3. Assert generic query/options words do not count as member anchors.
func TestMemberWordsIgnoreGenericQueryTerms(t *testing.T) {
  words := queryWords("Repository find relation query options")
  if !containsMemberWord(words, "find") {
    t.Fatal("find should remain a member anchor")
  }
  if !containsMemberWord(words, "FindOptionsRelations") {
    t.Fatal("relation should still anchor relation-domain names")
  }
  if containsMemberWord(words, "query") {
    t.Fatal("query should not be a natural member anchor")
  }
  if containsMemberWord(words, "createQueryBuilder") {
    t.Fatal("query should not promote createQueryBuilder as a natural member match")
  }
}
