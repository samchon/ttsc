package evidence

import "testing"

/**
 * Verifies the rule demands the block where a citation can actually live.
 *
 * A class is a type unit, and TypeScript requires it to precede the namespace
 * it merges with (`TS2434`), so `class Sale` beside `namespace Sale` is one
 * identity founded by the class. Naming a later half instead would send an
 * author's block somewhere the identity is not judged from, and this rule's
 * whole job is to name the position a citation can live in.
 *
 *  1. Document only the namespace half of a merged class identity.
 *  2. Run the rule.
 *  3. Assert the identity is still reported, because the class founds it.
 */
func TestDocumentedRejectsABlockOnALaterMergedDeclaration(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/Sale.ts", `
export class Sale {
  /** Price the customer pays. */
  price: number = 0;
}
/** A sale offered to a customer. */
export namespace Sale {
  /** Current version. */
  export const version = "1";
}
`, ""), "Missing JSDoc on exported type 'Sale'")
}

/**
 * Verifies the founding declaration satisfies the same pair.
 *
 * The twin of the case above, and the position the rule names. Together they
 * pin which declaration of the pair is demanded rather than leaving it to be
 * rediscovered from the collector's unit model.
 *
 *  1. Document only the class half of a merged class identity.
 *  2. Run the rule.
 *  3. Assert silence.
 */
func TestDocumentedAcceptsABlockOnTheFoundingDeclaration(t *testing.T) {
  assertSilent(t, runDocumentedRule(t, "src/Sale.ts", `
/** A sale offered to a customer. */
export class Sale {
  /** Price the customer pays. */
  price: number = 0;
}
export namespace Sale {
  /** Current version. */
  export const version = "1";
}
`, ""))
}

/**
 * Verifies `evidence/graph` accepts a citation in the position this rule
 * demands.
 *
 * The two cases above prove which declaration is named; this proves the naming
 * is worth obeying. Without it the rules could agree on a position that the
 * graph then refuses, and each rule's own suite would stay green while an
 * author following one diagnostic was handed another.
 *
 *  1. Cite a Markdown section from the class half of a merged class.
 *  2. Run the graph with a claim selecting `type` hosts.
 *  3. Assert no diagnostic at all.
 */
func TestGraphAcceptsEvidenceOnTheDeclarationDocumentedDemands(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/Sale.ts": `
/** @evidence docs/spec.md#contract The class half documents this contract. */
export class Sale {
  price: number = 0;
}
export namespace Sale {
  /** Current version. */
  export const version = "1";
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/Sale.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`))
}

/**
 * Verifies the graph rejects a citation on a declaration this rule refuses.
 *
 * The negative twin that makes the agreement falsifiable. An enum is now the
 * shape that materializes no unit, so it is the one declaration `documented`
 * asks nothing of and the graph refuses a tag on. If an enum ever became a
 * unit, this case fails and both rules should be revisited together rather
 * than one silently drifting from the other.
 *
 *  1. Cite the same section from a class and from an enum in the same file.
 *  2. Run the graph with the same claim.
 *  3. Assert the out-of-scope host diagnostic for the enum.
 */
func TestGraphRejectsEvidenceOnTheDeclarationDocumentedRefuses(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/Sale.ts": `
/** @evidence docs/spec.md#contract The class founds the identity and hosts this. */
export class Sale {
  price: number = 0;
}
/** @evidence docs/spec.md#contract An enum materializes no unit, so it hosts nothing. */
export enum Status {
  Draft = "draft",
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/Sale.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`), "unsupported or non-exported declaration")
}
