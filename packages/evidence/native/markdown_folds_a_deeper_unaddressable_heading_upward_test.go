package evidence

import (
  "testing"
)

/**
 * Verifies a deeper unaddressable heading still folds upward.
 *
 * The companion to the first case, and the one round 2 was aimed at. An H5 is
 * genuinely inside the H2 pricing section in this fixture, so its body belongs
 * to that unit and a rewrite there has to expire a review of it.
 *
 *  1. Digest an H2 containing an H5 subsection.
 *  2. Rewrite only the H5's body.
 *  3. Assert the H2's digest moved.
 *
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown through markdownUnitDigest exercises this case. Verifies a deeper unaddressable heading still folds upward.
 *
 * @evidence contracts/testing.md#independent-expectations The H5 body is inside pricing, so changing only that body must change its parent digest; the companion enclosing-region case guards against attribution to a sibling.
 *
 * @evidence contracts/testing.md#distinguishing-cases Digest an H2 containing an H5 subsection. Rewrite only the H5's body. Assert the H2's digest moved.
 *
 * @evidence contracts/testing.md#execution-ownership TestMarkdownFoldsADeeperUnaddressableHeadingUpward is the selectable Go entry and owns its fixture variants and local closures. It invokes scanProjectMarkdown through markdownUnitDigest in the native Go process. It consumes authored strings or parsed source nodes directly; no installed consumer, compiled host, or loader process participates.
 */
func TestMarkdownFoldsADeeperUnaddressableHeadingUpward(t *testing.T) {
  before := "## Pricing {#pricing}\n\nThe rate is capped.\n\n##### Details\n\nOne per issuer.\n"
  after := "## Pricing {#pricing}\n\nThe rate is capped.\n\n##### Details\n\nTwo per issuer.\n"
  if markdownUnitDigest(t, before, "docs/spec.md#pricing") ==
    markdownUnitDigest(t, after, "docs/spec.md#pricing") {
    t.Fatal("content under an H5 belongs to no digest, so a citation of its parent never expires")
  }
}
