package evidence

import "testing"

/**
 * Verifies citing one member leaves the rest owing an acknowledgement.
 *
 * The twin of ClassCitationAcknowledgesItsMembers. A cascade that had widened from the cited scope
 * to the whole class would make both cases pass, and the obligation would
 * quietly become "cite anything in this class".
 *
 *  1. Select the same member population.
 *  2. Cite only one field.
 *  3. Assert the remaining members are reported unacknowledged.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule cites only Sale.prototype.price and requires three remaining missing acknowledgements.
 * @evidence contracts/testing.md#independent-expectations The class fixture independently contains four public selected members; one field citation covers exactly one.
 * @evidence contracts/testing.md#distinguishing-cases A narrow field citation detects accidental widening to the whole class; the three messages are counted without individually checking their targets.
 * @evidence contracts/testing.md#execution-ownership TestCitingOneClassMemberLeavesTheRestOwing is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestCitingOneClassMemberLeavesTheRestOwing(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/Sale.ts": classMemberReferenceSource,
    "src/ledger.ts": `
import type { Sale } from "./Sale.js";

/** @evidence {@link Sale.prototype.price} Records the price and nothing else. */
export interface ILedger {}
`,
  }, classMemberReferenceConfig)
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 3 {
    t.Fatalf(
      "the three uncited members must each be reported, got %d:\n%v",
      count,
      messages,
    )
  }
}
