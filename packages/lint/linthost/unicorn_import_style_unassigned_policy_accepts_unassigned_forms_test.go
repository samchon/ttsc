package linthost

import (
  "testing"
)

// TestUnicornImportStyleUnassignedPolicyAcceptsUnassignedForms verifies
// every syntax family that carries the unassigned style: side-effect
// imports, empty named clauses, bare dynamic imports, statement-level
// require calls, empty destructuring, and `export {} from`.
//
// These authored forms are accepted by the native unassigned-only policy;
// a port that classified `import {} from` as named would fail here.
//
//  1. Configure module `unassigned` to allow only the unassigned style.
//  2. Write each unassigned-style form once.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification The engine accepts all retained unassigned module forms without a finding.
// @evidence contracts/testing.md#independent-expectations The supported style grammar independently treats side effects, empty bindings and empty exports as unassigned.
// @evidence contracts/testing.md#distinguishing-cases Bare require/import/dynamic import, empty require destructuring/named import and empty export are clean; assigned forms belong to the reported host.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleUnassignedPolicyAcceptsUnassignedForms owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleUnassignedPolicyAcceptsUnassignedForms(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `require("unassigned");
const {} = require("unassigned");
import "unassigned";
import {} from "unassigned";
import("unassigned");
export {} from "unassigned";
`, unicornImportStylePolicyOptions)
}
