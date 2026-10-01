package linthost

import "testing"

// TestBoundariesDependenciesChecksDeclarationFileDependencies verifies the
// declaration-file dispatch contract remains functional after implementation.
//
// Hand-written `.d.ts` files create architecture edges through type re-exports
// and import-type nodes. The engine allowlist already admits the rule; this
// witness ensures the checker-backed collector and `.d.ts` resolver do too.
//
// 1. Materialize app and domain declaration files.
// 2. Re-export and import the domain type from the app declaration.
// 3. Assert both exact declaration dependency literals are rejected.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed dependencies report type reexport and import-type edges from a declaration file instead of silently skipping .d.ts sources.
// @evidence contracts/testing.md#independent-expectations The authored app-to-domain policy applies to type dependency edges too; both literal module substrings are independently expected.
// @evidence contracts/testing.md#distinguishing-cases Declaration-file extension and two type-edge syntax forms distinguish declaration skipping from ordinary source support.
// @evidence contracts/testing.md#execution-ownership runBoundaryRuleProgram loads the authored .d.ts fixture into a Program/checker and calls program.runLintCycle. This entry owns both type dependency edges as one Go unit.
func TestBoundariesDependenciesChecksDeclarationFileDependencies(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := `export type { Domain } from "../domain/types";
export type LazyDomain = import("../domain/types").Domain;
`
  findings := runBoundaryRuleProgram(
    t,
    ruleName,
    "src/app/index.d.ts",
    source,
    `{
      "elements": [
        {"type":"app","pattern":"src/app/**"},
        {"type":"domain","pattern":"src/domain/**"}
      ],
      "default":"allow",
      "policies":[{"from":"app","disallow":"domain"}]
    }`,
    map[string]string{
      "src/domain/types.d.ts": "export interface Domain { readonly id: string; }",
    },
    nil,
  )
  assertBoundaryFindingTexts(
    t,
    source,
    findings,
    `"../domain/types"`,
    `"../domain/types"`,
  )
}
