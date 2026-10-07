package linthost

import (
  "testing"
)

// TestUnicornImportStyleSkipsNonMatchingReferenceShapes verifies the
// retained structural negatives: multi-argument statement calls, non-static
// require calls, member and assignment positions, import-equals declarations
// and local exports.
//
// These authored near misses constrain the native call/declarator matchers.
// Argument-less calls cannot resolve a module and must remain silent here;
// this test does not execute or certify an upstream crash.
//
//  1. Configure the four policy modules plus default table.
//  2. Evaluate the retained near-miss shapes.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification The real engine requires zero findings for the retained structural near-miss references.
// @evidence contracts/testing.md#independent-expectations The supported native reference scope independently excludes the retained nonstatic, extra-argument statement, optional, member, assignment, import-equals and local-export shapes; argument-less calls cannot resolve a module.
// @evidence contracts/testing.md#distinguishing-cases Original malformed/nonstatic require, assigned/member forms, local exports and nonstatic await stay clean beside separate reported direct forms.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleSkipsNonMatchingReferenceShapes owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleSkipsNonMatchingReferenceShapes(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `declare const variable: string;
declare function require(name?: unknown, extra?: unknown, more?: unknown): { x: number };
declare const foo: { require(name: string): void };
require(1, 2, 3);
require(variable);
require();
require?.("util");
const x = require(variable);
const y = require();
const z = require("unassigned").x;
let assigned;
assigned = require("util");
foo.require("util");
import legacy = require("util");
const p = variable ? 1 : 2;
export { p };
export const q = 1;
async () => {
  const { red } = await import(variable);
};
void [x, y, z, assigned, legacy];
`, unicornImportStylePolicyOptions)
}
