package linthost

import (
  "testing"
)

// TestUnicornImportStyleSkipsNonMatchingReferenceShapes verifies the
// structural negatives upstream never reports: multi-argument or
// non-static require calls, member and assignment positions,
// `import … = require(…)` equals-declarations, and local exports.
//
// Each shape is one property away from a reported form, so any
// over-broad matcher in the call or declarator path fails here. One
// deliberate deviation hides in `const y = require()`: upstream throws
// (`sourceCode.getScope(undefined)`) on the argument-less declarator,
// so graceful silence is this port's canonical replacement for a crash.
//
//  1. Configure the four policy modules plus default table.
//  2. Write every near-miss shape.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification The real engine requires zero findings for the retained structural near-miss references.
// @evidence contracts/testing.md#independent-expectations The supported direct static-reference scope independently excludes nonstatic/extra/optional/member/assignment/import-equals/local-export shapes; graceful argument-less silence is a stated port departure.
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
