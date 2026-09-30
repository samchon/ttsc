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
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory retrieves ISale's digest; extra leading blank lines and a line note must preserve it, while price number to string must change it.
 * @evidence contracts/testing.md#independent-expectations A declaration digest excludes leading trivia and includes executable type content; equality and inequality are independently specified relations rather than a hard-coded hash.
 * @evidence contracts/testing.md#distinguishing-cases The preceding IFirst declaration keeps the trivia boundary realistic. Retrieval proves ISale exists, but no separate nonempty digest or exact hash assertion is made.
 * @evidence contracts/testing.md#execution-ownership TestFingerprintIgnoresLeadingTrivia is a selectable native Go unit entry exercising the owning operations named in its behavioral answer in-process. Its direct fixture values and local comparisons require no installed artifact or product process.
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
