package evidence

import (
  "testing"
)

/**
 * Verifies an edit above an undocumented cited declaration expires nothing.
 *
 * A TypeScript node's position is its *full* start, so an undocumented
 * declaration's text begins at the previous token and arrives carrying the blank
 * lines and `//` comments above it. Keeping them made inserting one blank line
 * elsewhere in the file expire the review, and inconsistently: above a documented
 * declaration the whole leading run is already excluded as a tag position, so the
 * same edit was neutral there. A reformat that changes no content must expire
 * nothing, whichever of the two the author happens to be looking at.
 *
 *  1. Digest one cited interface that has no documentation block.
 *  2. Add a blank line and a `//` comment above it.
 *  3. Assert the digest did not move, then assert a change to the declaration
 *     itself still does.
 */
func TestFingerprintIgnoresLeadingTrivia(t *testing.T) {
  digestOf := func(content string) string {
    inventory := parseTypeScriptInventory(t, "src/spec.ts", content)
    for _, unit := range inventory.Units {
      if unit.Target == "ISale" {
        return unit.Digest
      }
    }
    t.Fatalf("expected a unit for ISale in:\n%s", content)
    return ""
  }
  bare := digestOf(`export interface IFirst {}

export interface ISale {
  price: number;
}
`)
  padded := digestOf(`export interface IFirst {}


// A note to a future reader.
export interface ISale {
  price: number;
}
`)
  if bare != padded {
    t.Fatal("leading blank lines and a line comment changed the digest, so a reformat expires a review")
  }
  changed := digestOf(`export interface IFirst {}

export interface ISale {
  price: string;
}
`)
  if changed == bare {
    t.Fatal("a signature change left the digest unmoved, so a real contract change expires nothing")
  }
}

/**
 * Verifies a `//` line inside Markdown prose still counts as content.
 *
 * The leading-trivia rule belongs to TypeScript, where such a line is trivia the
 * span merely swallowed. In Markdown a line opening with `//` is ordinary prose,
 * and stripping it in the shared normalizer would have deleted real content from
 * the digest of any section that happens to start one that way.
 *
 *  1. Digest a section whose body opens with a `//` line.
 *  2. Change that line's text.
 *  3. Assert the digest moved.
 */
func TestMarkdownKeepsAProseLineOpeningWithSlashes(t *testing.T) {
  digestOf := func(content string) string {
    inventory, _ := scanProjectMarkdown("docs/spec.md", content)
    for _, unit := range inventory.Units {
      if unit.Target == "docs/spec.md#pricing" {
        return unit.Digest
      }
    }
    t.Fatalf("expected a unit for the H2 in:\n%s", content)
    return ""
  }
  before := digestOf("## Pricing\n\n// the rate is capped at 30%\n")
  after := digestOf("## Pricing\n\n// the rate is capped at 45%\n")
  if before == after {
    t.Fatal("a Markdown line opening with slashes is missing from the digest")
  }
}
