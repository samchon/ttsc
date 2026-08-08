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
 * A class scope's fingerprint composes the class with every descendant, and a
 * parameter property is a descendant that arrives through the constructor
 * rather than through the member list. If the shorthand were left out of the
 * subtree, a reviewer could sign off on a class and have every constructor-
 * declared field rewritten under them without the review ever expiring, which
 * is the exact failure `requireReview` exists to prevent.
 *
 *  1. Cite the class from another module and review it with the value the graph
 *     asks for.
 *  2. Assert the graph is clean.
 *  3. Change the parameter property's type and assert the review is now stale.
 */
func TestClassScopeReviewExpiresOnAParameterProperty(t *testing.T) {
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
  assertProblemContains(t, runIndexRule(t, classReviewProject(`
export class Sale {
  readonly declared: number = 0;
  constructor(public readonly price: bigint) {}
}
`, review), classReviewConfig), "Stale @evidenceReview for '{@link Sale}'")
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
