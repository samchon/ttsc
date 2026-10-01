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
 * @evidence contracts/testing.md#behavioral-verification prismaClaimOf is called with a comment-only schema holding a file-level `///` run that ends in `@evidenceExclude docs/spec.md#contract ...` and no model inventory; it must return no problems and exactly one declaration whose Tag is the exclusion tag, Target is `docs/spec.md#contract`, Hosts is empty and ExclusionCarrier is true.
 * @evidence contracts/testing.md#independent-expectations The expected declaration fields are authored from the carrier contract: an unattached top-level triple-slash run is preserved as an exclusion declaration that claims no model host and is marked eligible only as a carrier.
 * @evidence contracts/testing.md#distinguishing-cases One file-level run with no model; hosted model comments and invalid carrier tags are owned by sibling entries. The Prisma parser itself is not involved because no model inventory is supplied.
 * @evidence contracts/testing.md#execution-ownership TestGraphAcceptsFileLevelPrismaExclusionCarrier is a Go unit entry in the native test process; it calls prismaClaimOf on an in-memory string with no Prisma bridge, filesystem, consumer install or product host.
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
