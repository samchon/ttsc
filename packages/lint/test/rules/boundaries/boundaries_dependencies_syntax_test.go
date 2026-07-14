package linthost

import "testing"

// TestBoundariesDependenciesCollectsModuleSyntaxAndMetadata verifies every
// supported dependency-producing syntax reaches the unified policy engine.
//
// The selector checks node kind, dependency kind, and imported specifier name;
// a collector that only recognizes ordinary imports or erases type metadata
// cannot satisfy the complete exact-range oracle.
//
//  1. Parse static import/export, import-equals, dynamic import, require, and
//     import-type forms.
//  2. Select each form through dependency metadata under app-to-domain policy.
//  3. Assert all seven module literals report, including type and typeof imports.
func TestBoundariesDependenciesCollectsModuleSyntaxAndMetadata(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := `import type { Foo } from "../domain/types";
export { value } from "../domain/value";
import legacy = require("../domain/required");
void import("../domain/dynamic");
const required = require("../domain/required");
type Imported = import("../domain/types").Foo;
type Namespace = typeof import("../domain/value");
void required;
void legacy;
`
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{
    "elements": [
      {"type":"app","pattern":"src/app/**"},
      {"type":"domain","pattern":"src/domain/**"}
    ],
    "default":"allow",
    "policies": [
      {
        "from":"app",
        "disallow":{
          "to":"domain",
          "dependency":{"nodeKind":["ExportDeclaration","ImportEqualsDeclaration","ImportCall","RequireCall","ImportType"]}
        }
      },
      {
        "from":"app",
        "disallow":{
          "to":"domain",
          "dependency":{"kind":"type","nodeKind":"ImportDeclaration","specifiers":"Foo"}
        }
      }
    ]
  }`, map[string]string{
    "src/domain/types.ts":    "export interface Foo {}",
    "src/domain/value.ts":    "export const value = 1;",
    "src/domain/dynamic.ts":  "export {};",
    "src/domain/required.ts": "export {};",
  })
  assertBoundaryFindingTexts(
    t,
    source,
    findings,
    `"../domain/types"`,
    `"../domain/value"`,
    `"../domain/dynamic"`,
    `"../domain/required"`,
    `"../domain/required"`,
    `"../domain/types"`,
    `"../domain/value"`,
  )
}
