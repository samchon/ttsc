package evidence

import (
  "testing"
)

/**
 * TestMarkdownAnnotationHeadingsBelongToTheNearestShallowerHeading verifies
 * which host a visible annotation answers for.
 *
 * An annotation belongs to the section it is nested in: the nearest outline
 * heading shallower than its own depth, or the file when none precedes it. A
 * heading of the annotation's own depth is a sibling, so an H2 annotation after
 * an H2 section belongs to the H1 above both. A nested annotation heading
 * starts its own annotation with the same owner, and a later ordinary heading
 * resumes the outline as if no annotation had been written.
 *
 *  1. Scan a document with an annotation before any heading, an H2 annotation
 *     beside an H2, an H3 annotation under it holding a nested H4 annotation,
 *     and an ordinary H3 afterwards.
 *  2. Require every declaration's host identity and symbol, and the later H3's
 *     parent.
 *
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown inventories one document and the case compares each visible declaration's target, HostID and host symbol with the file, H1 and H2 units it must belong to, then requires the ordinary H3 after the sections to keep the H2 as its parent.
 * @evidence contracts/testing.md#independent-expectations The ownership rule fixes each owner from the authored outline alone: no heading before the first annotation, the H1 above a sibling H2 annotation, and the H2 above the H3 annotation and its nested H4; parents follow the ordinary headings only.
 * @evidence contracts/testing.md#distinguishing-cases File, H1 and H2 owners, a same-depth sibling versus a deeper child annotation, a nested annotation heading, and the outline after a section; graph coverage of an owner is owned by the enclosing-section entry.
 * @evidence contracts/testing.md#execution-ownership TestMarkdownAnnotationHeadingsBelongToTheNearestShallowerHeading is a native Go unit entry; scanProjectMarkdown runs the Markdown scanner on in-memory content in the test process with no graph or product host.
 */
func TestMarkdownAnnotationHeadingsBelongToTheNearestShallowerHeading(t *testing.T) {
  inventory, problems := scanProjectMarkdown("docs/plan.md", "### @evidence docs/spec.md#intro\n\nThe file opens with the intro.\n\n"+
    "# Plan\n\n## Pricing {#pricing}\n\nThe cap.\n\n"+
    "## @evidence docs/spec.md#whole\n\nThe whole plan follows the spec.\n\n"+
    "## Rounding {#rounding}\n\nRound half up.\n\n"+
    "### @evidence docs/spec.md#rounding\n\nRounds as the spec says.\n\n"+
    "#### @evidenceExclude docs/spec.md#banker\n\nBanker's rounding is not used.\n\n"+
    "### Ties {#ties}\n\nTies round up.\n")
  if len(problems) != 0 || len(inventory.Unreadable) != 0 {
    t.Fatalf("unexpected problems: %v %v", problems, inventory.Unreadable)
  }
  units := map[string]*evidenceUnit{}
  for _, unit := range inventory.Units {
    units[unit.Target] = unit
  }
  for _, expected := range []struct {
    target string
    owner  string
    symbol string
  }{
    {"docs/spec.md#intro", "docs/plan.md", "file"},
    {"docs/spec.md#whole", "docs/plan.md#plan", "h1"},
    {"docs/spec.md#rounding", "docs/plan.md#rounding", "h2"},
    {"docs/spec.md#banker", "docs/plan.md#rounding", "h2"},
  } {
    var found *evidenceDeclaration
    for _, declaration := range inventory.Declarations {
      if declaration.Target == expected.target {
        found = declaration
      }
    }
    owner := units[expected.owner]
    if found == nil || owner == nil || found.HostID != owner.ID || !found.Hosts[expected.symbol] || len(found.Hosts) != 1 {
      t.Fatalf("%s must belong to %s (%s): declaration %#v, owner %#v", expected.target, expected.owner, expected.symbol, found, owner)
    }
  }
  if ties := units["docs/plan.md#ties"]; ties == nil || ties.ParentID != units["docs/plan.md#rounding"].ID {
    t.Fatalf("the heading after the sections lost its parent: %#v", ties)
  }
  if len(inventory.Units) != 5 {
    t.Fatalf("annotation headings must materialize no unit: %#v", inventory.Units)
  }
}
