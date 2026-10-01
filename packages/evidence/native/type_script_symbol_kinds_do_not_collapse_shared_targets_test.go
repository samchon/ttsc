package evidence

import (
  "testing"
)

/**
 * Verifies TypeScript's type and value namespaces do not collapse evidence
 * units that share one public target text.
 *
 * An interface and a callable `const` may legally export the same name. A
 * function-only source must retain the callable, while a source selecting both
 * kinds must report that the unqualified declaration target is ambiguous.
 *
 *  1. Export an interface and arrow function named `Shared` from one file.
 *  2. Select only `"function"` and assert `Shared` resolves to the callable.
 *  3. Select both kinds and assert the shared target becomes ambiguous.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs graphRule.Check twice over one fixture exporting an interface and a callable const both named Shared: with symbol "function" the graph must be clean, and with ["type","function"] it must contain a diagnostic with "Ambiguous evidence target '{@link Shared}'".
 * @evidence contracts/testing.md#independent-expectations The expectation follows from TypeScript allowing a type and a value of the same name and from a bare link naming one target; one kind leaves it unique, two kinds make it ambiguous. The expected message text is a literal authored here, not computed from the rule.
 * @evidence contracts/testing.md#distinguishing-cases The same sources and citation differ only in the reference symbol selector, giving a no-finding case for the single kind and a finding for both kinds.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptSymbolKindsDoNotCollapseSharedTargets is a Go unit entry; runIndexRule writes the fixtures to a temp root, parses them and calls graphRule.Check in-process without a consumer install or product host.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptSymbolKindsDoNotCollapseSharedTargets runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptSymbolKindsDoNotCollapseSharedTargets(t *testing.T) {
  files := map[string]string{
    "src/contracts.ts": `
export interface Shared {
  value: string;
}
export const Shared = (): void => {};
`,
    "src/ledger.ts": `import type { Shared } from "./contracts";

/** @evidence {@link Shared} The public callable is documented. */
export interface ILedger {}
`,
  }
  functionOnly := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":"function"}
  }]}`)
  assertNoProblems(t, functionOnly)

  bothKinds := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":["type","function"]}
  }]}`)
  assertProblemContains(t, bothKinds, "Ambiguous evidence target '{@link Shared}'")
}
