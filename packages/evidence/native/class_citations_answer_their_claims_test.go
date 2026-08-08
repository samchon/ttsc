package evidence

import "testing"

const classTypeClaimConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "symbol":"type",
  "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
}]}`

/**
 * Verifies a class satisfies a type claim by citing its specification.
 *
 * This is the obligation the class exists to carry: the class states the
 * subject, so the subject is what answers for the document describing it.
 * Before the class was a unit, only its methods could answer, which put the
 * obligation one level below the thing that has it.
 *
 * The uncited second section is what keeps this from passing on an empty
 * population. A claim whose selected hosts all vanish deactivates and reports
 * nothing, so a class that had stopped being a `type` host would leave this
 * green. Demanding that exactly the uncited section is reported proves the
 * claim was live and the cited one really was discharged by the class.
 *
 *  1. Cite one of two Markdown sections from an exported class.
 *  2. Evaluate a `symbol: "type"` claim over that file.
 *  3. Assert the uncited section is the only thing reported.
 */
func TestClassCitationSatisfiesATypeClaim(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Sale {#sale}\n\nA sale offered to a customer.\n\n## Uncited {#uncited}\n\nNothing answers for this.\n",
    "src/Sale.ts": `
/** @evidence docs/spec.md#sale The sale contract this section specifies. */
export class Sale {
  price: number = 0;
}
`,
  }, classTypeClaimConfig), "Missing acknowledgement for 'docs/spec.md#uncited'")
}

/**
 * Verifies the same class without a citation fails the same claim.
 *
 * The firing twin. Without it, a claim that had stopped selecting classes
 * entirely would look identical to one they satisfy, because an unselected host
 * is silent in exactly the same way a satisfied one is.
 *
 *  1. Remove the citation and leave the class otherwise unchanged.
 *  2. Evaluate the same claim.
 *  3. Assert the section is reported unacknowledged.
 */
func TestUncitedClassFailsATypeClaim(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Sale {#sale}\n\nA sale offered to a customer.\n",
    "src/Sale.ts": `
/** A sale offered to a customer. */
export class Sale {
  price: number = 0;
}
`,
  }, classTypeClaimConfig), "Missing acknowledgement for 'docs/spec.md#sale'")
}

/**
 * Verifies a public class field satisfies a property claim while a private one
 * is not selected at all.
 *
 * `singleEvidencePerSymbol` is what makes the private half falsifiable: it
 * judges every selected host, including the ones carrying no tag, so a private
 * field that had slipped into the population would be reported for citing zero
 * units. Without the policy the two states are indistinguishable.
 *
 * The uncited second section is what makes the public half falsifiable. A claim
 * whose selected hosts all vanish goes inactive and reports nothing, so
 * asserting silence would pass just as well if class fields stopped being
 * property units altogether. Demanding that exactly the uncited section is
 * reported proves the claim was live and the cited one really was discharged.
 *
 *  1. Cite one of two Markdown sections from a public field beside a private
 *     one.
 *  2. Evaluate a `symbol: "property"` claim under singleEvidencePerSymbol.
 *  3. Assert the uncited section is the only thing reported.
 */
func TestPublicClassFieldSatisfiesAPropertyClaim(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Price {#price}\n\nThe amount the customer pays.\n\n## Uncited {#uncited}\n\nNothing answers for this.\n",
    "src/Sale.ts": `
export class Sale {
  /** @evidence docs/spec.md#price The price this section fixes. */
  public readonly price: number = 0;
  private ledger: number = 0;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2",
      "singleEvidencePerSymbol":true
    }
  }]}`), "Missing acknowledgement for 'docs/spec.md#uncited'")
}

const classMemberReferenceConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/ledger.ts"],
  "symbol":"type",
  "reference":{
    "type":"typescript",
    "files":["src/Sale.ts"],
    "symbol":["function","property"]
  }
}]}`

const classMemberReferenceSource = `
export class Sale {
  readonly price: number = 0;
  static readonly currency: string = "KRW";
  charge(): void {}
  static create(): Sale {
    return new Sale();
  }
}
`

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
 *  3. Assert both of the uncited class's members are reported and nothing else.
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

/**
 * Verifies citing one member leaves the rest owing an acknowledgement.
 *
 * The twin of the case above. A cascade that had widened from the cited scope
 * to the whole class would make both cases pass, and the obligation would
 * quietly become "cite anything in this class".
 *
 *  1. Select the same member population.
 *  2. Cite only one field.
 *  3. Assert the remaining members are reported unacknowledged.
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

/**
 * Verifies a function claim over class methods is unaffected by the class unit.
 *
 * The adoption promise of this change is that an existing configuration keeps
 * working. A `symbol: "function"` claim selects the methods and not the class,
 * so the class adds no obligation beside them.
 *
 * The uncited second section keeps that promise checkable. A claim whose
 * selected hosts all vanish goes inactive and reports nothing, so asserting
 * silence would pass just as well if class methods stopped being function units
 * at all, which is the opposite of the promise. Demanding that exactly the
 * uncited section is reported proves the method was a live host and the class
 * added nothing beside it. The other half of the promise, that the class is not
 * a host such a claim can use, is its own case below.
 *
 *  1. Cite one of two Markdown sections from a method, leaving the class
 *     undocumented.
 *  2. Evaluate a `symbol: "function"` claim.
 *  3. Assert the uncited section is the only thing reported.
 */
func TestFunctionClaimOverClassMethodsIsUnaffected(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Charge {#charge}\n\nHow a sale is charged.\n\n## Uncited {#uncited}\n\nNothing answers for this.\n",
    "src/Sale.ts": `
export class Sale {
  /** @evidence docs/spec.md#charge Charges the sale as this section describes. */
  charge(): void {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`), "Missing acknowledgement for 'docs/spec.md#uncited'")
}

/**
 * Verifies a class is not a host a function claim can use.
 *
 * The other half of the adoption promise, and the half nothing enforced:
 * registering the class as a `function` host beside its `type` one passed the
 * entire suite. A claim that selected methods would then silently accept a
 * citation on the class, so an existing configuration would start counting an
 * acknowledgement it never asked for.
 *
 *  1. Cite a Markdown section from the class under a `symbol: "function"` claim.
 *  2. Keep a method as the live host, so the claim is active either way.
 *  3. Assert the class citation is refused and the section stays unacknowledged.
 */
func TestClassIsNotAHostOfAFunctionClaim(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Charge {#charge}\n\nHow a sale is charged.\n",
    "src/Sale.ts": `
/** @evidence docs/spec.md#charge A class hosts nothing a function claim reads. */
export class Sale {
  charge(): void {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "is not selected (function)")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#charge'")
}

/**
 * Verifies a class is not a host a property claim can use either.
 *
 * The function case beside this one closed one selector and left the other
 * open: registering the class as a `property` host also passed the whole
 * suite. Host eligibility has three selectors and the class is a legitimate
 * host of exactly one of them, so a case per selector is what states that,
 * and closing them one at a time is how the second stayed open.
 *
 *  1. Cite a Markdown section from the class under a `symbol: "property"` claim.
 *  2. Keep a field as the live host, so the claim is active either way.
 *  3. Assert the class citation is refused and the section stays unacknowledged.
 */
func TestClassIsNotAHostOfAPropertyClaim(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Price {#price}\n\nThe amount the customer pays.\n",
    "src/Sale.ts": `
/** @evidence docs/spec.md#price A class hosts nothing a property claim reads. */
export class Sale {
  price: number = 0;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "is not selected (property)")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#price'")
}
