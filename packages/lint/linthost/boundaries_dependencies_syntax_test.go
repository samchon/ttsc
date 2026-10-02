package linthost

import (
  "strings"
  "testing"
)

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
//  3. Assert all seven original module literals report, including type and typeof imports.
//  4. Keep a Bar type import and a Foo value import clean to isolate metadata gates.
//
// @evidence contracts/testing.md#behavioral-verification Dependencies report the seven original module edges and leave two added ordinary imports clean: a different type specifier and a Foo value import.
// @evidence contracts/testing.md#independent-expectations The authored policies name distinct supported AST module forms and the Foo type specifier; seven literal module-string expectations define the denied edge population independently, while Bar differs only in specifier and FooValue differs in dependency kind from the denied Foo type import.
// @evidence contracts/testing.md#distinguishing-cases The seven original syntax forms preserve distinct denied ranges; Bar type and Foo value imports are ordinary ImportDeclaration negatives. Ignoring specifiers, type kind or the first policy's node-kind list would add a forbidden extra finding.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule parses the authored module forms and executes NewEngineWithResolver.Run. This entry owns all seven denied source-range expectations and the absence of findings at either added negative import, with no generated extra Test entry.
func TestBoundariesDependenciesCollectsModuleSyntaxAndMetadata(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := `import type { Foo } from "../domain/types";
export { value } from "../domain/value";
import legacy = require("../domain/required");
void import("../domain/dynamic");
const required = require("../domain/required");
type Imported = import("../domain/types").Foo;
type Namespace = typeof import("../domain/value");
import type { Bar } from "../domain/types";
import { Foo as FooValue } from "../domain/types";
void FooValue;
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
    "src/domain/types.ts":    "export interface Foo {}\nexport interface Bar {}\nexport const Foo = 1;",
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
  negativeStart := strings.Index(source, "import type { Bar }")
  for _, finding := range findings {
    if finding.Pos >= negativeStart {
      t.Fatalf("metadata-negative import was diagnosed: %+v", finding)
    }
  }
}
