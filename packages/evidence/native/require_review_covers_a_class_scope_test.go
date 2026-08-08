package evidence

import "testing"

const classReviewConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/ledger.ts"],
  "symbol":"type",
  "reference":{
    "type":"typescript",
    "files":["src/Sale.ts"],
    "symbol":["property"],
    "requireReview":true
  }
}]}`

// classReviewProject cites a class as an aggregate scope from another module.
//
// The reference selects only the fields, so the class itself is an unselected
// ancestor and the citation exercises the scope closure rather than a single
// unit. `review` is the tag line to place beside the citation, empty for the
// reading pass that asks the graph what value it expects.
func classReviewProject(sale string, review string) map[string]string {
  return map[string]string{
    "src/Sale.ts": sale,
    "src/ledger.ts": `
import type { Sale } from "./Sale.js";

/**
 * @evidence {@link Sale} Records every fact this subject owns.
` + review + ` */
export interface ILedger {}
`,
  }
}

const classReviewSource = `
export class Sale {
  readonly declared: number = 0;
  constructor(public readonly price: number) {}
}
`

/**
 * Verifies a review of a class expires when a field the constructor declares
 * changes.
 *
 * This is the behavior a reviewer meets: sign off on a class, have a
 * constructor-declared field rewritten underneath, and the review expires. It
 * is deliberately paired with the case below, because on its own it proves
 * less than it looks. A TypeScript unit's digest is its whole declaration text,
 * so the constructor's bytes sit inside the class digest whether or not the
 * shorthand is a subtree member, and this case would pass even if parameter
 * properties materialized nothing at all.
 *
 *  1. Cite the class from another module and review it with the value the graph
 *     asks for.
 *  2. Assert the graph is clean.
 *  3. Change the parameter property's type and assert the review is now stale.
 */
func TestClassScopeReviewExpiresOnAParameterProperty(t *testing.T) {
  assertClassScopeReviewExpires(t, `
export class Sale {
  readonly declared: number = 0;
  constructor(public readonly price: bigint) {}
}
`)
}

/**
 * Verifies withdrawing a parameter property expires the review of its class.
 *
 * The case that isolates subtree membership, which the type change above
 * cannot. Every documentation block is cut out of a unit's digest as a position
 * a tag can occupy, so adding `@internal` to the parameter leaves the class's
 * own text byte-identical. The composite moves only because the withdrawn
 * member is in the scope and contributes the tag that withdrew it. If parameter
 * properties were not subtree members, nothing here would change and the review
 * would stand while a field left the public surface under it.
 *
 *  1. Review the same class with the value the graph asks for.
 *  2. Withdraw the parameter property with `@internal`.
 *  3. Assert the review is stale.
 */
func TestClassScopeReviewExpiresWhenAParameterPropertyIsWithdrawn(t *testing.T) {
  assertClassScopeReviewExpires(t, `
export class Sale {
  readonly declared: number = 0;
  constructor(
    /**
     * @internal
     */
    public readonly price: number,
  ) {}
}
`)
}

// assertClassScopeReviewExpires reviews the shared class, then asserts the
// review goes stale against a changed version of it.
func assertClassScopeReviewExpires(t *testing.T, changed string) {
  t.Helper()
  expected := reviewedFingerprintAt(
    t,
    classReviewProject(classReviewSource, ""),
    classReviewConfig,
  )
  review := " * @evidenceReview {@link Sale} #" + expected +
    " Read every field of the subject against the schema.\n"
  assertNoProblems(t, runIndexRule(
    t,
    classReviewProject(classReviewSource, review),
    classReviewConfig,
  ))
  assertProblemContains(
    t,
    runIndexRule(t, classReviewProject(changed, review), classReviewConfig),
    "Stale @evidenceReview for '{@link Sale}'",
  )
}

/**
 * Verifies the same review survives an edit outside the class.
 *
 * The negative twin. A digest taken over the file rather than over the
 * declaration would expire on any edit at all, and the case above would pass
 * either way, so the boundary of the scope is what needs pinning rather than
 * the fact that something expires it. The sibling added here is a whole
 * declaration rather than whitespace, because whitespace alone is normalized
 * out and would prove nothing about the boundary.
 *
 *  1. Review the same class with the value the graph asks for.
 *  2. Add an unrelated declaration below it in the same file.
 *  3. Assert the graph is still clean.
 */
func TestClassScopeReviewSurvivesAnEditOutsideTheClass(t *testing.T) {
  expected := reviewedFingerprintAt(
    t,
    classReviewProject(classReviewSource, ""),
    classReviewConfig,
  )
  review := " * @evidenceReview {@link Sale} #" + expected +
    " Read every field of the subject against the schema.\n"
  assertNoProblems(t, runIndexRule(t, classReviewProject(`
export class Sale {
  readonly declared: number = 0;
  constructor(public readonly price: number) {}
}

export interface IUnrelated {}
`, review), classReviewConfig))
}
