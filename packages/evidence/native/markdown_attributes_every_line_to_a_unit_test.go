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
 * Overall Self-Review round 3 caught this, and it is the opposite failure from the
 * one round 2 fixed. Folding such a region into "the previous real unit" is right
 * only while the skipped heading is deeper than that unit. When it is shallower —
 * an anchorless H2 following an H3 — the previous unit is a *sibling*, so editing
 * text the H3 does not contain expired a review of the H3. A false expiry is not a
 * smaller fault than a missing one; it teaches authors that the rule cries wolf.
 *
 *  1. Build a document where an anchorless H2 follows an H3 under a cited H2.
 *  2. Change only the text under the anchorless heading.
 *  3. Assert the H3's digest is unmoved and the file's digest moved, since the
 *     file is the nearest unit that actually encloses that region.
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

/**
 * Verifies fenced content counts toward its section's digest.
 *
 * The walk handles fenced lines in their own branches and returns early from each,
 * so a value maintained only on the ordinary path never reaches them. Fenced
 * content hosts no tag, so it is never excluded as a tag position; dropping it
 * would mean rewriting the example inside a cited section expires nothing, which
 * is the exact silence the fingerprint exists to break.
 *
 *  1. Digest a section containing a fenced code block.
 *  2. Change only a line inside the fence.
 *  3. Assert the section's digest moved.
 */
func TestMarkdownCountsFencedContent(t *testing.T) {
  before := "## Pricing {#pricing}\n\n```ts\nconst cap = 30;\n```\n"
  after := "## Pricing {#pricing}\n\n```ts\nconst cap = 45;\n```\n"
  if markdownUnitDigest(t, before, "docs/spec.md#pricing") ==
    markdownUnitDigest(t, after, "docs/spec.md#pricing") {
    t.Fatal("fenced content is missing from the digest, so a change inside a code block expires nothing")
  }
}

/**
 * Verifies a deeper unaddressable heading still folds upward.
 *
 * The companion to the first case, and the one round 2 was aimed at. An H5 is
 * genuinely inside the H4 above it, so its body belongs to that unit and a
 * rewrite there has to expire a review of it.
 *
 *  1. Digest an H2 containing an H5 subsection.
 *  2. Rewrite only the H5's body.
 *  3. Assert the H2's digest moved.
 */
func TestMarkdownFoldsADeeperUnaddressableHeadingUpward(t *testing.T) {
  before := "## Pricing {#pricing}\n\nThe rate is capped.\n\n##### Details\n\nOne per issuer.\n"
  after := "## Pricing {#pricing}\n\nThe rate is capped.\n\n##### Details\n\nTwo per issuer.\n"
  if markdownUnitDigest(t, before, "docs/spec.md#pricing") ==
    markdownUnitDigest(t, after, "docs/spec.md#pricing") {
    t.Fatal("content under an H5 belongs to no digest, so a citation of its parent never expires")
  }
}
