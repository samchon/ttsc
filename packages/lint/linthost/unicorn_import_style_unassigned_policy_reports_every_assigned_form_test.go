package linthost

import (
  "testing"
)

// TestUnicornImportStyleUnassignedPolicyReportsEveryAssignedForm
// verifies the retained invalid `unassigned` forms: classified assigned
// styles report the independently authored literal diagnostic
// message.
//
// The declarator paths (require and awaited dynamic import) must
// classify the binding target, so identifier, object-pattern, aliased,
// rest, and array-pattern targets are all pinned here.
//
//  1. Configure module `unassigned` to allow only the unassigned style.
//  2. Evaluate the sixteen retained assigned-style references.
//  3. Assert sixteen findings with exact messages and representative ranges.
//
// @evidence contracts/testing.md#behavioral-verification The engine requires sixteen exact-message findings and checks representative declarator/export/await ranges.
// @evidence contracts/testing.md#independent-expectations An unassigned-only policy independently rejects references classified as default, namespace or named styles.
// @evidence contracts/testing.md#distinguishing-cases Identifier/object/alias/rest/array, static import, export and awaited import forms retain all original reports.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleUnassignedPolicyReportsEveryAssignedForm owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleUnassignedPolicyReportsEveryAssignedForm(t *testing.T) {
  source := `const { x } = require("unassigned");
const { default: y } = require("unassigned");
const { a: z } = require("unassigned");
const { ...rest } = require("unassigned");
const [] = require("unassigned");
const whole = require("unassigned");
import def from "unassigned";
import * as ns from "unassigned";
import { named } from "unassigned";
import { named as alias } from "unassigned";
export * from "unassigned";
export { e } from "unassigned";
export { e as f } from "unassigned";
export { default } from "unassigned";
async () => {
  const { g } = await import("unassigned");
};
async () => {
  const h = await import("unassigned");
};
void [x, y, z, rest, whole, def, ns, named, alias];
`
  findings := runUnicornImportStyleFindings(t, source, unicornImportStylePolicyOptions)
  message := "Use unassigned import for module `unassigned`."
  if len(findings) != 16 {
    t.Fatalf("want 16 findings, got %d (%+v)", len(findings), findings)
  }
  for index, finding := range findings {
    if finding.message != message {
      t.Fatalf("finding[%d] message: want %q, got %q", index, message, finding.message)
    }
  }
  if findings[0].target != `{ x } = require("unassigned")` {
    t.Fatalf("declarator range mismatch: %q", findings[0].target)
  }
  if findings[10].target != `export * from "unassigned";` {
    t.Fatalf("export-star range mismatch: %q", findings[10].target)
  }
  if findings[14].target != `{ g } = await import("unassigned")` {
    t.Fatalf("awaited-import declarator range mismatch: %q", findings[14].target)
  }
}
