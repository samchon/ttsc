package linthost

import (
  "testing"
)

// TestUnicornImportStyleNamespaceModulePolicyMatrix verifies the
// `namespace`-only module: namespace bindings and whole-object require
// targets pass, while the retained unassigned/default/named forms report.
//
// `const x = require("namespace")` is valid because identifier targets
// are namespace-style; `const { default: x }` is a default-style
// violation. Array-binding targets also classify as namespace.
//
//  1. Configure module `namespace` to allow only the namespace style.
//  2. Assert the compliant forms are clean.
//  3. Assert each violating form reports the exact message.
//
// @evidence contracts/testing.md#behavioral-verification The engine compares retained namespace/whole-object forms with thirteen exact-message violations.
// @evidence contracts/testing.md#independent-expectations The supported namespace classifier independently accepts identifier/array targets but rejects default and named bindings.
// @evidence contracts/testing.md#distinguishing-cases Whole-object require/import/await and export-star are clean; unassigned/default/named forms report.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleNamespaceModulePolicyMatrix owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleNamespaceModulePolicyMatrix(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `const x = require("namespace");
const [] = require("namespace");
import * as y from "namespace";
async () => {
  const z = await import("namespace");
  void z;
};
export * from "namespace";
export * as ns from "namespace";
void [x, y];
`, unicornImportStylePolicyOptions)

  source := `require("namespace");
const {} = require("namespace");
import "namespace";
import {} from "namespace";
import("namespace");
const { default: a } = require("namespace");
const { ...rest } = require("namespace");
import b from "namespace";
const { c } = require("namespace");
import { d } from "namespace";
async () => {
  const { e } = await import("namespace");
};
export { f } from "namespace";
export { default } from "namespace";
void [a, rest, b, c, d];
`
  findings := runUnicornImportStyleFindings(t, source, unicornImportStylePolicyOptions)
  message := "Use namespace import for module `namespace`."
  if len(findings) != 13 {
    t.Fatalf("want 13 findings, got %d (%+v)", len(findings), findings)
  }
  for index, finding := range findings {
    if finding.message != message {
      t.Fatalf("finding[%d] message: want %q, got %q", index, message, finding.message)
    }
  }
}
