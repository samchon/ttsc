package evidence

import "testing"

/**
 * Verifies a top-level unattached triple-slash run becomes an exclusion
 * carrier without claiming a Prisma model host.
 *
 * Prisma's parser and arbitrary-extension boundary belong to the consumer
 * fixture. The native half must preserve the declaration with no host symbol
 * and mark only its exclusion eligibility for later graph evaluation.
 *
 *  1. Scan a comment-only file-level exclusion run.
 *  2. Materialize it without any parsed model inventory.
 *  3. Assert its target, empty host set, and carrier flag.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaClaimOf and its native comment scanner exercises this case: Verifies a top-level unattached triple-slash run becomes an exclusion carrier without claiming a Prisma model host. The original assertions check assert its target, empty host set, and carrier flag.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Prisma's parser and arbitrary-extension boundary belong to the consumer fixture. The native half must preserve the declaration with no host symbol and mark only its exclusion eligibility for later graph evaluation. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Scan a comment-only file-level exclusion run. Materialize it without any parsed model inventory. Assert its target, empty host set, and carrier flag. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphAcceptsFileLevelPrismaExclusionCarrier is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises prismaClaimOf and its native comment scanner within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphAcceptsFileLevelPrismaExclusionCarrier(t *testing.T) {
  declarations, problems := prismaClaimOf(`/// Lint-only exclusion ledger.
///
/// @evidenceExclude docs/spec.md#contract This schema intentionally stores no state for the section.
`, nil)
  if len(problems) != 0 {
    t.Fatalf("a file-level exclusion carrier must parse cleanly: %v", problems)
  }
  if len(declarations) != 1 {
    t.Fatalf("expected one exclusion declaration, got %d", len(declarations))
  }
  declaration := declarations[0]
  if declaration.Tag != tagExclude ||
    declaration.Target != "docs/spec.md#contract" ||
    len(declaration.Hosts) != 0 ||
    !declaration.ExclusionCarrier {
    t.Fatalf("unexpected file-level carrier: %#v", declaration)
  }
}
