package evidence

import (
  "testing"
)

/**
 * TestPrismaHeadingAnnotationsCiteAndExclude verifies a Prisma documentation
 * comment accepts the heading form with Prisma's own tag boundaries.
 *
 * A model's `///` run can hold a heading-form citation whose explanation has
 * blank lines and a deeper heading, and another tool's tag such as `@stance`
 * still ends it. An unattached top-level run accepts a heading-form exclusion
 * as a file-level carrier, exactly as it accepts the line form.
 *
 *  1. Scan a model documented with a heading-form citation followed by a tag.
 *  2. Scan a comment-only exclusion ledger written in heading form.
 *  3. Require the host, target, reason and carrier flag of each declaration.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaClaimOf scans an in-memory schema whose `Sale` model carries a heading-form `@evidence` section ended by `@stance`, and a comment-only schema whose run is a heading-form `@evidenceExclude`; the case compares each declaration's host set, target, reason, tag and ExclusionCarrier flag with literals and requires no problems.
 * @evidence contracts/testing.md#independent-expectations Prisma attaches a `///` run to the model below it, its documentation treats another tool's tag as a boundary, and an unattached top-level run is an exclusion carrier; the heading form changes how the tag is spelled, not where it lives, so the expected values are the line form's.
 * @evidence contracts/testing.md#distinguishing-cases A hosted citation and an unattached exclusion cover both Prisma placements; the `@stance` line after a deeper heading separates the tag boundary from section structure. Misplaced and buried heading tags are owned by the unreadable-heading entry.
 * @evidence contracts/testing.md#execution-ownership TestPrismaHeadingAnnotationsCiteAndExclude is a native Go unit entry; prismaClaimOf scans strings in-process with supplied models and no Prisma bridge, filesystem, consumer install or product host.
 */
func TestPrismaHeadingAnnotationsCiteAndExclude(t *testing.T) {
  declarations, problems := prismaClaimOf(`/// A sale.
///
/// ## @evidence docs/spec.md#pricing
///
/// The sale price derives from this section.
///
/// ### Storage
///
/// It is stored in cents.
/// @stance material
model Sale {
  price Int
  seller Seller
}
`, prismaClaimModels)
  if len(problems) != 0 {
    t.Fatalf("a heading-form citation must scan cleanly: %v", problems)
  }
  if len(declarations) != 1 {
    t.Fatalf("expected one citation, got %s", prismaDeclarationIndex(declarations))
  }
  cited := declarations[0]
  if cited.Tag != tagEvidence ||
    cited.Hosts.names() != "model" ||
    cited.Target != "docs/spec.md#pricing" ||
    cited.Reason != "The sale price derives from this section.\n\n### Storage\n\nIt is stored in cents." {
    t.Fatalf("unexpected heading-form citation: %s", prismaDeclarationIndex(declarations))
  }

  ledger, problems := prismaClaimOf(`/// Lint-only exclusion ledger.
///
/// ## @evidenceExclude docs/spec.md#contract
///
/// This schema intentionally stores no state for the section.
`, nil)
  if len(problems) != 0 {
    t.Fatalf("a heading-form file-level carrier must scan cleanly: %v", problems)
  }
  if len(ledger) != 1 ||
    ledger[0].Tag != tagExclude ||
    ledger[0].Target != "docs/spec.md#contract" ||
    ledger[0].Reason != "This schema intentionally stores no state for the section." ||
    !ledger[0].ExclusionCarrier ||
    len(ledger[0].Hosts) != 0 {
    t.Fatalf("unexpected heading-form carrier: %s", prismaDeclarationIndex(ledger))
  }
}
