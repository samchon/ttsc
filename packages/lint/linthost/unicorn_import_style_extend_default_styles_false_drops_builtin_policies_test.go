package linthost

import (
  "testing"
)

// TestUnicornImportStyleExtendDefaultStylesFalseDropsBuiltinPolicies
// verifies `extendDefaultStyles: false`: the built-in table disappears
// entirely, leaving only the user's own module policies active.
//
// Without this branch the defaults would leak through and flag `chalk`
// and `util` even when the user replaced the table.
//
//  1. Disable extension with an empty and a single-module table.
//  2. Assert former default-table modules are unrestricted.
//  3. Assert the user's own module policy still fires.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution drops builtin policies while retaining the authored custom-module finding.
// @evidence contracts/testing.md#independent-expectations The supported replacement-table option independently removes defaults rather than merging them.
// @evidence contracts/testing.md#distinguishing-cases Former chalk/util violations stay clean under empty/custom replacement tables, while custom default import reports.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleExtendDefaultStylesFalseDropsBuiltinPolicies owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleExtendDefaultStylesFalseDropsBuiltinPolicies(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    `require("chalk");
import util from "util";
import { red } from "chalk";
void [util, red];
`,
    `{"styles": {}, "extendDefaultStyles": false}`,
  )

  findings := runUnicornImportStyleFindings(
    t,
    `import util from "util";
import custom from "custom";
void [util, custom];
`,
    `{"styles": {"custom": {"named": true}}, "extendDefaultStyles": false}`,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `import custom from "custom";`,
    message: "Use named import for module `custom`.",
  })
}
