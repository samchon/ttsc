package evidence

import "testing"

/**
 * Verifies a claim that cannot address code does not reach a symbol through
 * another claim's reference.
 *
 * This replaces a case asserting that a plain-token code target from Markdown
 * is ambiguous when two files export one name (upstream lint-plugin-evidence#82). That hazard is gone
 * by construction — such a claim cannot declare a TypeScript reference at all —
 * but the configuration guard alone did not finish the job, and what it left
 * was silent. Addresses are indexed from every claim at once, so a Markdown
 * claim citing a document could still land on a symbol some OTHER claim's
 * TypeScript reference had materialized. Measured before the fix: it resolved
 * and reported nothing, which left repository-wide symbol-name uniqueness
 * load-bearing through a door the guard does not cover.
 *
 * The message must not be "unresolved", which would be true and useless: the
 * unit exists, and the author needs to hear why naming it here cannot work.
 *
 *  1. Configure a TypeScript claim over TypeScript, and a Markdown claim over
 *     Markdown, in one graph.
 *  2. Cite the code symbol by plain token from the Markdown claim.
 *  3. Assert it is refused, naming the citing artifact and the repair.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a claim that cannot address code does not reach a symbol through another claim's reference. The original assertions check assert it is refused, naming the citing artifact and the repair.
 * @evidence contracts/testing.md#independent-expectations This replaces a case asserting that a plain-token code target from Markdown is ambiguous when two files export one name (upstream lint-plugin-evidence#82). That hazard is gone by construction — such a claim cannot declare a TypeScript reference at all — but the configuration guard alone did not finish the job, and what it left was silent. Addresses are indexed from every claim at once, so a Markdown claim citing a document could still land on a symbol some OTHER claim's TypeScript reference had materialized. Measured before the fix: it resolved and reported nothing, which left repository-wide symbol-name uniqueness load-bearing through a door the guard does not cover. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Configure a TypeScript claim over TypeScript, and a Markdown claim over Markdown, in one graph. Cite the code symbol by plain token from the Markdown claim. Assert it is refused, naming the citing artifact and the repair. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationsRefuseCodeTargetsFromAnotherClaimsReference is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDeclarationsRefuseCodeTargetsFromAnotherClaimsReference(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/contracts.ts": "export interface Shared {}\n",
    "src/claim.ts": `import type { Shared } from "./contracts";

/** @evidence {@link Shared} The code cites its own reference. */
export interface IClaim {}
`,
    "docs/spec.md": "## Pricing {#pricing}\n",
    "docs/ref.md": `<!-- @evidence docs/spec.md#pricing This document relies on the section. -->
<!-- @evidence Shared This document relies on the shared type. -->
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "files":["src/claim.ts"],
      "symbol":"type",
      "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":"type"}
    },
    {
      "type":"markdown",
      "files":["docs/ref.md"],
      "symbol":"file",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    }
  ]}`)
  assertProblemContains(t, messages, "Code evidence target 'Shared'")
  assertProblemContains(t, messages, "unqualified symbol has no module identity")
  assertProblemContains(t, messages, "@link")
}
