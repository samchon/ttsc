package mcp

import "testing"

// TestNaturalMemberWordsRequireAction verifies natural owner-member scoring
// does not promote sibling methods from a single noun embedded in the member.
//
// Relation-flow questions often name several owners and nouns in one broad
// query. A member such as `getRepository` or `createQueryBuilder` should not tie
// with the requested `find` path unless its own action words are present.
//
//  1. Score a TypeORM relation-flow query against requested and sibling methods.
//  2. Assert the requested `find` methods outrank noun-only siblings.
//  3. Assert an explicit get-repository query still matches `getRepository`.
func TestNaturalMemberWordsRequireAction(t *testing.T) {
	flowWords := queryWords("Repository find EntityManager find SelectQueryBuilder setFindOptions applyFindOptions buildRelations relation options query builder")
	repositoryFind := naturalDottedScore("Repository.find", flowWords)
	repositoryCreateQueryBuilder := naturalDottedScore("Repository.createQueryBuilder", flowWords)
	if repositoryFind <= repositoryCreateQueryBuilder {
		t.Fatalf("Repository.find should outrank Repository.createQueryBuilder: find=%d createQueryBuilder=%d", repositoryFind, repositoryCreateQueryBuilder)
	}
	entityManagerFind := naturalDottedScore("EntityManager.find", flowWords)
	entityManagerGetRepository := naturalDottedScore("EntityManager.getRepository", flowWords)
	if entityManagerFind <= entityManagerGetRepository {
		t.Fatalf("EntityManager.find should outrank EntityManager.getRepository: find=%d getRepository=%d", entityManagerFind, entityManagerGetRepository)
	}
	if naturalDottedScore("SelectQueryBuilder.setFindOptions", flowWords) == 0 {
		t.Fatal("exact member phrase setFindOptions should remain a natural match")
	}
	typoOwnerWords := queryWords("selectquerybuildler setFindOptions applyFindOptions buildRelations relations")
	if exactMemberScore("SelectQueryBuilder.setFindOptions", typoOwnerWords) == 0 ||
		exactMemberScore("SelectQueryBuilder.applyFindOptions", typoOwnerWords) == 0 ||
		exactMemberScore("SelectQueryBuilder.buildRelations", typoOwnerWords) == 0 {
		t.Fatal("exact member names should rank even when the owner token is misspelled")
	}

	getWords := queryWords("EntityManager get repository")
	if naturalDottedScore("EntityManager.getRepository", getWords) == 0 {
		t.Fatal("explicit get repository query should still match getRepository")
	}
}
