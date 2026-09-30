package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies Markdown claim headings retain semantic host identities for policy counts.
 *
 * Markdown declarations already carried a physical outline host, but cardinality also needs every selected heading that carries no HTML comment. Exercising the complete project rule proves the scanner's heading unit ID is the same semantic ID used by both policy directions.
 *
 *  1. Select one silent H2 and one positively citing H2 as claim hosts.
 *  2. Assert only the silent host fails single-evidence cardinality.
 *  3. Make two headings cite one unit, then give each its own, and assert unique evidence rejects the first and accepts the second.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies Markdown claim headings retain semantic host identities for policy counts. The original assertions check make two headings cite one unit, then give each its own, and assert unique evidence rejects the first and accepts the second.
 * @evidence contracts/testing.md#independent-expectations Markdown declarations already carried a physical outline host, but cardinality also needs every selected heading that carries no HTML comment. Exercising the complete project rule proves the scanner's heading unit ID is the same semantic ID used by both policy directions. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Select one silent H2 and one positively citing H2 as claim hosts. Assert only the silent host fails single-evidence cardinality. Make two headings cite one unit, then give each its own, and assert unique evidence rejects the first and accepts the second. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownClaimHostsParticipateInReferencePolicyCounts is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestMarkdownClaimHostsParticipateInReferencePolicyCounts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "claims/positive.md": `## Positive {#positive}

<!-- @evidence docs/spec.md#contract Implements the contract. -->
`,
    "claims/untagged.md": "## Untagged {#untagged}\n",
    "docs/spec.md":       "## Contract {#contract}\n",
  }, markdownClaimReferencePolicyConfig)
  if count := countProblemsContaining(messages, "singleEvidencePerSymbol"); count != 1 {
    t.Fatalf("expected only the silent Markdown host to fail cardinality, got %d:\n%s", count, strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "Markdown H2 'Untagged'")
  assertProblemContains(t, messages, "cites 0 distinct selected evidence unit(s)")
  if strings.Contains(strings.Join(messages, "\n"), "Markdown H2 'Positive'") {
    t.Fatalf("the positive Markdown host failed cardinality:\n%s", strings.Join(messages, "\n"))
  }

  shared := runIndexRule(t, map[string]string{
    "claims/first.md": `## First {#first}

<!-- @evidence docs/spec.md#contract First proof. -->
`,
    "claims/second.md": `## Second {#second}

<!-- @evidence docs/spec.md#contract Second proof. -->
`,
    "docs/spec.md": "## Contract {#contract}\n",
  }, markdownClaimReferencePolicyConfig)
  assertProblemContains(t, shared, "has 2 distinct positive evidence host(s); uniqueEvidence allows at most 1")

  passing := runIndexRule(t, map[string]string{
    "claims/first.md": `## First {#first}

<!-- @evidence docs/spec.md#contract Implements the contract. -->
`,
    "claims/second.md": `## Second {#second}

<!-- @evidence docs/spec.md#pricing Implements the pricing rule. -->
`,
    "docs/spec.md": "## Contract {#contract}\n\n## Pricing {#pricing}\n",
  }, markdownClaimReferencePolicyConfig)
  assertNoProblems(t, passing)
}
