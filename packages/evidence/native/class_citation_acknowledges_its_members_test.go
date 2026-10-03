package evidence

import "testing"

/**
 * Verifies a citation on the class acknowledges every member below it.
 *
 * The class is an aggregate scope, so a project that cites at the subject level
 * is not also made to cite each method and field. The reference selects only
 * the members, which is the case that proves the ancestor stays addressable
 * even when its own kind is outside the selector.
 *
 * The uncited sibling class is what keeps this from passing on a population
 * that shrank, and it carries a method as well as a field on purpose. The
 * reference selects both kinds, so a sibling holding only a field would leave
 * the case green when methods stopped materializing: the citation would cover
 * whatever survived and the expected count would not move. Two uncited members
 * of different kinds make the count answer for both halves.
 *
 *  1. Select two classes' callables and fields as the reference population.
 *  2. Cite one class itself, once, from another module.
 *  3. Assert both uncited class members are named and exactly two missing findings remain.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule cites Sale as an aggregate over selected functions and properties; two named Uncited members and a missing-count of two are required.
 * @evidence contracts/testing.md#independent-expectations Scope coverage follows descendants: Sale members are covered, Uncited.rate and Uncited.recalculate remain independent obligations.
 * @evidence contracts/testing.md#distinguishing-cases The sibling field and method detect loss of either selected kind; assertions count missing findings rather than every diagnostic.
 * @evidence contracts/testing.md#execution-ownership TestClassCitationAcknowledgesItsMembers is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestClassCitationAcknowledgesItsMembers(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/Sale.ts": classMemberReferenceSource + `
export class Uncited {
  rate: number = 0;
  recalculate(): void {}
}
`,
    "src/ledger.ts": `
import type { Sale } from "./Sale.js";

/** @evidence {@link Sale} Records every operation and fact this subject owns. */
export interface ILedger {}
`,
  }, classMemberReferenceConfig)
  assertProblemContains(t, messages, "Missing acknowledgement for 'Uncited.prototype.rate'")
  assertProblemContains(t, messages, "Missing acknowledgement for 'Uncited.prototype.recalculate'")
  if count := countProblemsContaining(messages, "Missing acknowledgement"); count != 2 {
    t.Fatalf(
      "only the uncited class's two members may be reported, got %d:\n%v",
      count,
      messages,
    )
  }
}
