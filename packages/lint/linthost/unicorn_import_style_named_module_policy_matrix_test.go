package linthost

import (
  "testing"
)

// TestUnicornImportStyleNamedModulePolicyMatrix verifies the
// `named`-only module across every syntax family, including the mixed
// `import util, {inspect}` form where one disallowed style among the
// actual styles is enough to report.
//
// Named destructuring of an awaited dynamic import passes while its
// array-pattern twin (namespace style) fails, pinning the
// binding-target classifier in both directions.
//
//  1. Configure module `named` to allow only the named style.
//  2. Assert the compliant forms are clean.
//  3. Assert each violating form reports the exact message.
//
// @evidence contracts/testing.md#behavioral-verification The actual rule compares named bindings with sixteen exact-message violations and authored mixed/array ranges.
// @evidence contracts/testing.md#independent-expectations Every actual style must be allowed; named-only independently rejects a declaration containing an additional default style.
// @evidence contracts/testing.md#distinguishing-cases Named object/rest/alias imports and exports are clean; empty/default/namespace/array and mixed default-named forms report.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleNamedModulePolicyMatrix owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleNamedModulePolicyMatrix(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `const { x } = require("named");
const { ...rest } = require("named");
const { a: y } = require("named");
import { z } from "named";
import { z as w } from "named";
async () => {
  const { b } = await import("named");
};
async () => {
  const { c: d } = await import("named");
};
export { e } from "named";
export { e as f } from "named";
void [x, rest, y, z, w];
`, unicornImportStylePolicyOptions)

  source := `require("named");
const {} = require("named");
const [] = require("named");
import "named";
import {} from "named";
import("named");
const a = require("named");
const { default: b } = require("named");
import c from "named";
import * as ns from "named";
import util, { inspect } from "named";
async () => {
  const { default: d } = await import("named");
};
async () => {
  const [e] = await import("named");
};
async () => {
  const f = await import("named");
};
export * from "named";
export { default } from "named";
void [a, b, c, ns, util, inspect];
`
  findings := runUnicornImportStyleFindings(t, source, unicornImportStylePolicyOptions)
  message := "Use named import for module `named`."
  if len(findings) != 16 {
    t.Fatalf("want 16 findings, got %d (%+v)", len(findings), findings)
  }
  for index, finding := range findings {
    if finding.message != message {
      t.Fatalf("finding[%d] message: want %q, got %q", index, message, finding.message)
    }
  }
  if findings[10].target != `import util, { inspect } from "named";` {
    t.Fatalf("mixed import range mismatch: %q", findings[10].target)
  }
  if findings[12].target != `[e] = await import("named")` {
    t.Fatalf("array-pattern declarator range mismatch: %q", findings[12].target)
  }
}
