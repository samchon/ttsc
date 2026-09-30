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
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot exercises this case: Verifies Prisma claim models retain semantic host identities for policy counts. The original assertions check make two models cite one unit, then give each its own, and assert unique evidence rejects the first and accepts the second.
 * @evidence contracts/testing.md#independent-expectations Prisma units come from the native parser bridge while their comments and locations come from a separate scanner. A model with no documentation must still enter cardinality as zero, and a parsed `///` citation must map back to the same model identity for both host and unit counts. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Parse one silent model and one positively citing model through the real bridge and project rule. Assert only the silent model fails single-evidence cardinality. Make two models cite one unit, then give each its own, and assert unique evidence rejects the first and accepts the second. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestPrismaClaimHostsParticipateInReferencePolicyCounts is the selectable Go test entry; its local loops and closures remain owned by this entry. It runs the installed Node Prisma loader from the Go test process and belongs to the repository Go E2E overlay.
 * @evidence contracts/e2e.md#necessary-boundary runIndexRuleAtRoot consumes model inventory through the installed evidence Node loader and pinned Prisma parser. Parse one silent model and one positively citing model through the real bridge and project rule. Make two models cite one unit, then give each its own, and assert unique evidence rejects the first and accepts the second. An authored model DTO would bypass parser resolution and model/comment assembly.
 * @evidence contracts/e2e.md#shared-execution The pnpm-installed evidence package and compiled loader are shared across this Go E2E process; this case does not install dependencies or build a native contributor. requireColdPrismaSchemaFixture removes only the exact schema-content outcome before the first load of each authored schema. That miss starts the real Node parser; subsequent equivalent loads inside the graph evaluation reuse its result. Changed schema inputs require separate parser starts because the synchronous installed bridge consumes one schema set per call; the installed package, compiled loader and Go process are not rebuilt.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates a distinct fixture root under the installed suite and registers its removal with t.Cleanup. Each root resolves the same installed package while keeping files separate; the cold-fixture helper removes this schema's one native content-cache entry before its loader call and preserves unrelated entries. These Go tests are serial, so no concurrent case can repopulate the key before the boundary executes. The synchronous loader joins any Node child it starts. t.Cleanup owns removal after normal completion or test failure; abrupt process termination can leave the fixture root.
 * @evidence contracts/e2e.md#preserved-coverage TestPrismaClaimHostsParticipateInReferencePolicyCounts retains every original schema variant and assertion in the Go E2E overlay, with bounded cold-fixture preparation added before the original loader call. Make two models cite one unit, then give each its own, and assert unique evidence rejects the first and accepts the second. Portable graph cases in the native unit population do not claim to prove this installed parser connection.
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
