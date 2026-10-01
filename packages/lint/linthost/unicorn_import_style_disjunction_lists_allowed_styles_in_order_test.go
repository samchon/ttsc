package linthost

import (
  "testing"
)

// TestUnicornImportStyleDisjunctionListsAllowedStylesInOrder verifies
// the message formatter against upstream's en-US disjunction list:
// three styles render as "a, b, or c" in configuration order, two as
// "a or b" with the inherited default first.
//
// Style order comes from JavaScript object-spread semantics (defaults
// first, then user-added keys), which the ordered JSON decoding must
// reproduce.
//
//  1. Configure a module with three allowed styles and violate it.
//  2. Extend `util` (default `named`) with `default` and violate it.
//  3. Assert both exact messages.
//
// @evidence contracts/testing.md#behavioral-verification Actual reports are compared with authored three-style and inherited two-style messages.
// @evidence contracts/testing.md#independent-expectations The supported en-US disjunction and default-first object-spread ordering independently establish both full messages.
// @evidence contracts/testing.md#distinguishing-cases Three configured styles and inherited named-plus-default retain their distinct order and punctuation.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleDisjunctionListsAllowedStylesInOrder owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleDisjunctionListsAllowedStylesInOrder(t *testing.T) {
  findings := runUnicornImportStyleFindings(
    t,
    "require(\"no-unassigned\");\n",
    `{"styles": {"no-unassigned": {"named": true, "namespace": true, "default": true}}}`,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `require("no-unassigned")`,
    message: "Use named, namespace, or default import for module `no-unassigned`.",
  })

  findings = runUnicornImportStyleFindings(
    t,
    "import * as util from \"node:util\";\nvoid util;\n",
    `{"styles": {"util": {"default": true}}}`,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `import * as util from "node:util";`,
    message: "Use named or default import for module `node:util`.",
  })
}
