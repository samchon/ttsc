//go:build e2e

package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies Prisma claim models retain semantic host identities for policy counts.
 *
 * Prisma units come from the native parser bridge while their comments and locations come from a separate scanner. A model with no documentation must still enter cardinality as zero, and a parsed `///` citation must map back to the same model identity for both host and unit counts.
 *
 *  1. Parse one silent model and one positively citing model through the real bridge and project rule.
 *  2. Assert only the silent model fails single-evidence cardinality.
 *  3. Make two models cite one unit, then give each its own, and assert unique evidence rejects the first and accepts the second.
 * @evidence contracts/testing.md#behavioral-verification Three runs against a prisma claim with markdown policy singleEvidencePerSymbol and uniqueEvidence: (1) one citing model and one silent model -> exactly one singleEvidencePerSymbol failure naming Prisma model 'Untagged' with 'cites 0 distinct selected evidence unit(s)' and none for 'Positive' (L48-L55); (2) two models citing one section -> 'has 2 distinct positive evidence host(s); uniqueEvidence allows at most 1' (L71); (3) each citing its own section -> no problems (L87).
 * @evidence contracts/testing.md#independent-expectations Expected counts and message fragments are literals authored from the policy definitions (single evidence per symbol, unique evidence) and the fixtures' citation counts; they are not copied from a previous output.
 * @evidence contracts/testing.md#distinguishing-cases Silent host vs positive host (cardinality 0 vs 1), shared evidence unit across hosts (rejected) vs distinct units (accepted); a model citing the same unit twice and column/relation hosts are not run here.
 * @evidence contracts/testing.md#execution-ownership TestPrismaClaimHostsParticipateInReferencePolicyCounts is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls runIndexRuleAtRoot three times through its run closure, each after requireColdPrismaSchemaFixture. It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary Each run's loadPrismaInventories (via normalizePrismaSet, forced to miss the cache by requireColdPrismaSchemaFixture) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution The run closure creates a new root per call and clears that schema's cache entry first, so each of the three runs starts its own Node child (three in total); no resident bridge is shared. The installed link and compiled loaders are shared prerequisites this test does not build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each run creates a prismaBridgeRoot under packages/evidence/native with t.Cleanup removal and rewrites the same schema file via runIndexRuleAtRoot; requireColdPrismaSchemaFixture deletes only that schema's prismaSchemas entry so unrelated entries survive, and each child has exited before its run returns.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts the single-evidence failure count and message fragments for the silent host (L48-L55), the two-host uniqueEvidence rejection (L71) and a clean third run (L87).
 */
func TestPrismaClaimHostsParticipateInReferencePolicyCounts(t *testing.T) {
  run := func(document string, schema string) []string {
    root := prismaBridgeRoot(t, nil)
    requireColdPrismaSchemaFixture(t, root, "prisma/schema.prisma", schema)
    return runIndexRuleAtRoot(t, root, map[string]string{
      "docs/spec.md":         document,
      "prisma/schema.prisma": schema,
    }, prismaClaimReferencePolicyConfig)
  }
  const oneSection = "## Contract {#contract}\n"
  messages := run(oneSection, `datasource db {
  provider = "sqlite"
}

model Untagged {
  id Int @id
}

/// @evidence docs/spec.md#contract Implements the contract.
model Positive {
  id Int @id
}
`)
  if count := countProblemsContaining(messages, "singleEvidencePerSymbol"); count != 1 {
    t.Fatalf("expected only the silent Prisma host to fail cardinality, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Prisma model 'Untagged'")
  assertProblemContains(t, messages, "cites 0 distinct selected evidence unit(s)")
  if strings.Contains(strings.Join(messages, "\n"), "Prisma model 'Positive'") {
    t.Fatalf("the positive Prisma host failed cardinality:\n%s", strings.Join(messages, "\n"))
  }

  shared := run(oneSection, `datasource db {
  provider = "sqlite"
}

/// @evidence docs/spec.md#contract First proof.
model First {
  id Int @id
}

/// @evidence docs/spec.md#contract Second proof.
model Second {
  id Int @id
}
`)
  assertProblemContains(t, shared, "has 2 distinct positive evidence host(s); uniqueEvidence allows at most 1")

  passing := run("## Contract {#contract}\n\n## Pricing {#pricing}\n", `datasource db {
  provider = "sqlite"
}

/// @evidence docs/spec.md#contract Implements the contract.
model First {
  id Int @id
}

/// @evidence docs/spec.md#pricing Implements the pricing rule.
model Second {
  id Int @id
}
`)
  assertNoProblems(t, passing)
}
