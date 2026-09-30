package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies Prisma model hosts obey positive and exclusion cardinality.
 *
 * Prisma declarations are reconstructed from comments beside authored model
 * DTOs. Host identity must survive that association
 * so different models may cite one requirement while one model cannot repeat
 * it, and exclusions remain unique across the claim.
 *
 *  1. Repeat positive evidence across models and then on one model.
 *  2. Repeat an exclusion across models.
 *  3. Assert only the same-host positive and repeated exclusion fail.
 * @evidence contracts/testing.md#behavioral-verification runPrismaAcknowledgementGraph exercises this case: Verifies Prisma model hosts obey positive and exclusion cardinality. The original assertions check assert only the same-host positive and repeated exclusion fail.
 * @evidence contracts/testing.md#independent-expectations Prisma declarations are reconstructed from comments beside authored model DTOs. Host identity must survive that association so different models may cite one requirement while one model cannot repeat it, and exclusions remain unique across the claim. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Repeat positive evidence across models and then on one model. Repeat an exclusion across models. Assert only the same-host positive and repeated exclusion fail. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestPrismaHostsPreserveAcknowledgementCardinality calls runPrismaAcknowledgementGraph with authored model DTOs and scanned comments in one Go process; it does not invoke the installed Prisma parser. This entry owns every model variant in the function.
 *
 */
func TestPrismaHostsPreserveAcknowledgementCardinality(t *testing.T) {
  t.Run("positive across models", func(t *testing.T) {
    messages := runPrismaAcknowledgementGraph(t, `/// @evidence docs/spec.md#contract First model ownership.
model First {
  id String @id
}

/// @evidence docs/spec.md#contract Second model ownership.
model Second {
  id String @id
}
`, "First", "Second")
    assertNoProblems(t, messages)
  })
  t.Run("positive repeated on one model", func(t *testing.T) {
    messages := runPrismaAcknowledgementGraph(t, `/// @evidence docs/spec.md#contract First reason.
/// @evidence docs/spec.md#contract Second reason.
model First {
  id String @id
}
`, "First")
    assertSingleEvidenceDuplicate(t, messages, "docs/spec.md#contract")
  })
  t.Run("exclusion repeated across models", func(t *testing.T) {
    messages := runPrismaAcknowledgementGraph(t, `/// @evidenceExclude docs/spec.md#contract First exclusion.
model First {
  id String @id
}

/// @evidenceExclude docs/spec.md#contract Second exclusion.
model Second {
  id String @id
}
`, "First", "Second")
    if got := countProblemsContaining(messages, "Duplicate @evidenceExclude"); got != 1 {
      t.Fatalf("Prisma exclusions produced %d duplicates:\n%s", got, strings.Join(messages, "\n"))
    }
  })
}
