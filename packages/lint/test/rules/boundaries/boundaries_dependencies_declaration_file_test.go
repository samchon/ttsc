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
