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

// classReviewSource is the reviewed baseline.
//
// The constructor is written out over several lines even though it holds one
// parameter, so the withdrawal regression can add `@internal` while changing
// nothing else. Collapsing it would make that case move the class's own text
// and pass for a reason it does not claim.
const classReviewSource = `
export class Sale {
  readonly declared: number = 0;
  constructor(
    /**
     * The price the customer pays.
     */
    public readonly price: number,
  ) {}
}
`

// classWithdrawnSource is classReviewSource with the parameter property's block
// replaced by `@internal` and nothing else touched.
//
// Shared by the expiry case and the certificate that the class's own text does
// not move, because the two only mean anything together: if they held separate
// copies, one could drift into changing the class text and the expiry case
// would go back to passing for the textual reason it claims not to depend on.
const classWithdrawnSource = `
export class Sale {
  readonly declared: number = 0;
  constructor(
    /**
     * @internal
     */
    public readonly price: number,
  ) {}
}
`







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
