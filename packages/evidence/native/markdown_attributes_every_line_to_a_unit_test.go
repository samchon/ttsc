package evidence

import (
  "testing"
)

// markdownUnitDigest reads one target's own-content digest from a document.
func markdownUnitDigest(t *testing.T, content string, target string) string {
  t.Helper()
  inventory, _ := scanProjectMarkdown("docs/spec.md", content)
  for _, unit := range inventory.Units {
    if unit.Target == target {
      return unit.Digest
    }
  }
  t.Fatalf("expected a unit for %q in:\n%s", target, content)
  return ""
}

/**
 * Verifies a region under an unaddressable heading belongs to its enclosing unit,
 * not to whichever unit the walk saw last.
 *
 * Folding such a region into "the previous real unit" is right only while the
 * skipped heading is deeper than that unit. When it is shallower —
 * an anchorless H2 following an H3 — the previous unit is a *sibling*, so editing
 * text the H3 does not contain expired a review of the H3. A false expiry is not a
 * smaller fault than a missing one; it teaches authors that the rule cries wolf.
 *
 *  1. Build a document where an anchorless H2 follows an H3 under a cited H2.
 *  2. Change only the text under the anchorless heading.
 *  3. Assert the H3's digest is unmoved and the enclosing H1 spec digest moved,
 *     since spec is the nearest addressable unit that encloses that region.
 *
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown through markdownUnitDigest exercises this case. Verifies a region under an unaddressable heading belongs to its enclosing unit, not to whichever unit the walk saw last.
 *
 * @evidence contracts/testing.md#independent-expectations Changing only the later anchorless H2 region must leave coupons unchanged and change the enclosing spec digest. This checks attribution rather than a particular hash value.
 *
 * @evidence contracts/testing.md#distinguishing-cases Build a document where an anchorless H2 follows an H3 under a cited H2. Change only the text under the anchorless heading. Assert the H3's digest is unmoved and the enclosing H1 spec digest moved, since spec is the nearest addressable unit that encloses that region.
 *
 * @evidence contracts/testing.md#execution-ownership TestMarkdownAttributesARegionToItsEnclosingUnit is the selectable Go entry and owns its fixture variants and local closures. It invokes scanProjectMarkdown through markdownUnitDigest in the native Go process. It consumes authored strings or parsed source nodes directly; no installed consumer, compiled host, or loader process participates.
 */
func TestMarkdownAttributesARegionToItsEnclosingUnit(t *testing.T) {
  before := "# Spec\n\n## Pricing {#pricing}\n\n### Coupons {#coupons}\n\nOne per issuer.\n\n## {#}\n\nStray prose.\n"
  after := "# Spec\n\n## Pricing {#pricing}\n\n### Coupons {#coupons}\n\nOne per issuer.\n\n## {#}\n\nRewritten prose.\n"
  if markdownUnitDigest(t, before, "docs/spec.md#coupons") !=
    markdownUnitDigest(t, after, "docs/spec.md#coupons") {
    t.Fatal("text under a later anchorless heading was attributed to the H3 above it")
  }
  if markdownUnitDigest(t, before, "docs/spec.md#spec") ==
    markdownUnitDigest(t, after, "docs/spec.md#spec") {
    t.Fatal("text under an anchorless heading reached no enclosing unit, so a citation of it never expires")
  }
}
