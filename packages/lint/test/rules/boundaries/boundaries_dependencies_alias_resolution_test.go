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
