package evidence

import (
  "testing"
)

/**
 * Verifies an obligation names the first declaration in its diagnostic.
 *
 * The complementary inventory unit tests read the inventory directly; this reads what a user
 * sees. A missing acknowledgement sends its reader to a line, and that line has
 * to be the identity's first declaration no matter which half was written
 * first.
 *
 *  1. Obligate a merged identity from a TypeScript claim, in both orders.
 *  2. Leave it unacknowledged.
 *  3. Assert the diagnostic points at line 2 either way.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the diagnostic points at line 2 either way.
 * @evidence contracts/testing.md#independent-expectations The complementary inventory unit tests read the inventory directly; this reads what a user sees. A missing acknowledgement sends its reader to a line, and that line has to be the identity's first declaration no matter which half was written first. The authored scenario requires this outcome: Assert the diagnostic points at line 2 either way.
 * @evidence contracts/testing.md#distinguishing-cases Obligate a merged identity from a TypeScript claim, in both orders. Leave it unacknowledged. Assert the diagnostic points at line 2 either way.
 * @evidence contracts/testing.md#execution-ownership TestMissingAcknowledgementNamesTheFirstDeclaration runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestMissingAcknowledgementNamesTheFirstDeclaration(t *testing.T) {
  for name, source := range map[string]string{
    "interface first": `
export interface ISale {
  price: number;
}
export namespace ISale {
  export const version: string = "1";
}
`,
    "namespace first": `
export namespace ISale {
  export const version: string = "1";
}
export interface ISale {
  price: number;
}
`,
  } {
    messages := runIndexRule(t, map[string]string{
      "src/claim.ts":   "export interface IClaim {}\n",
      "src/subject.ts": source,
    }, mergedIdentityReferenceConfig)
    assertProblemContains(t, messages, "Missing acknowledgement for 'ISale'")
    assertProblemContains(t, messages, "with @evidence on a selected typescript host, building that artifact first when none does, or write @evidenceExclude on an eligible carrier when nothing here owes it.")
    if countProblemsContaining(messages, "Add '@evidence") != 0 {
      t.Fatal("the replaced verbose missing-acknowledgement repair survived")
    }
    if countProblemsContaining(messages, "at src/subject.ts:2)") == 0 {
      t.Fatalf("%s: the obligation must name the first declaration's line", name)
    }
  }
}
