package linthost

import (
  "testing"
)

// TestUnicornImportStyleDefaultModulePolicyMatrix verifies the
// `default`-only module: default bindings pass, and the require paths
// additionally accept namespace-shaped targets because CommonJS interop
// cannot distinguish `x = require(...)` from a compiled default export.
//
// The interop extension applies to `require` only — `const x = await
// import("default")` stays a violation — which is the branch most
// easily lost in a port.
//
//  1. Configure module `default` to allow only the default style.
//  2. Assert the compliant forms (including require interop) are clean.
//  3. Assert each violating form reports the exact message.
//
// @evidence contracts/testing.md#behavioral-verification The engine compares every retained compliant default form with twelve exact-message violations.
// @evidence contracts/testing.md#independent-expectations The supported require-only CommonJS interop exception allows whole-object targets under default policy; awaited import retains namespace semantics.
// @evidence contracts/testing.md#distinguishing-cases Default bindings and require interop are clean, while unassigned/named/static namespace and awaited whole-object forms report.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleDefaultModulePolicyMatrix owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleDefaultModulePolicyMatrix(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `const x = require("default");
const { default: y } = require("default");
const [] = require("default");
import z from "default";
async () => {
  const { default: w } = await import("default");
  void w;
};
export { default } from "default";
void [x, y, z];
`, unicornImportStylePolicyOptions)

  source := `require("default");
const {} = require("default");
const { ...rest } = require("default");
import "default";
import {} from "default";
import("default");
import * as ns from "default";
const { a } = require("default");
import { b } from "default";
async () => {
  const c = await import("default");
};
export * from "default";
export { d } from "default";
void [rest, ns, a, b];
`
  findings := runUnicornImportStyleFindings(t, source, unicornImportStylePolicyOptions)
  message := "Use default import for module `default`."
  if len(findings) != 12 {
    t.Fatalf("want 12 findings, got %d (%+v)", len(findings), findings)
  }
  for index, finding := range findings {
    if finding.message != message {
      t.Fatalf("finding[%d] message: want %q, got %q", index, message, finding.message)
    }
  }
  if findings[0].target != `require("default")` {
    t.Fatalf("bare require range mismatch: %q", findings[0].target)
  }
  if findings[5].target != `import("default")` {
    t.Fatalf("dynamic import range mismatch: %q", findings[5].target)
  }
}
