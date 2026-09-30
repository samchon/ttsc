package linthost

import "testing"

// TestBoundariesDependenciesClassifiesResolvedAliases verifies written module
// spelling does not decide whether a dependency is local.
//
// TypeScript `paths` aliases omit the relative prefix used by the filesystem
// fallback. The checker must resolve ordinary imports, re-exports, and dynamic
// imports to the same domain source file before element classification. The
// fixture uses bundler resolution because that is the module mode in which an
// extensionless alias is legal for every one of those syntaxes; NodeNext
// rejects it for ESM-mode dynamic imports before lint ever runs.
//
// 1. Configure an `@domain/*` tsconfig path alias to a domain element.
// 2. Import, re-export, and dynamically import the aliased module from app.
// 3. Assert all three alias literals are rejected by the app-to-domain policy.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed dependency classification resolves @domain/model to the domain element for import, reexport and dynamic import.
// @evidence contracts/testing.md#independent-expectations The fixture paths mapping explicitly binds @domain/* to src/domain/*; app disallows domain, so three authored module-string targets are required.
// @evidence contracts/testing.md#distinguishing-cases All three module forms retain alias spelling while using resolved target identity; distinct ranges prevent duplicated findings masquerading as complete coverage.
// @evidence contracts/testing.md#execution-ownership runBoundaryRuleProgram materializes the authored paths-mapped app/domain fixture, loads a Program/checker and calls program.runLintCycle on NewEngineWithResolver. This entry owns the three alias edges in the same Go process.
func TestBoundariesDependenciesClassifiesResolvedAliases(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := `import { model } from "@domain/model";
export { model as exportedModel } from "@domain/model";
void import("@domain/model");
void model;
`
  findings := runBoundaryRuleProgram(
    t,
    ruleName,
    "src/app/main.ts",
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
      "src/domain/model.ts": "export const model = 1;",
    },
    map[string]any{
      "module":           "ESNext",
      "moduleResolution": "Bundler",
      "paths":            map[string]any{"@domain/*": []string{"src/domain/*"}},
    },
  )
  assertBoundaryFindingTexts(
    t,
    source,
    findings,
    `"@domain/model"`,
    `"@domain/model"`,
    `"@domain/model"`,
  )
}
