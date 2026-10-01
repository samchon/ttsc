package linthost

import (
  "testing"
)

// TestUnicornImportStyleStyleOverridesReplaceInheritedFlags verifies
// per-style overrides on top of the default table: `util: false`
// clears the policy, `util: {named: false}` disables the only allowed
// style (leaving the module unrestricted, not banned), and explicit
// `{default: true, named: false}` swaps the allowed style.
//
// These are upstream's regression cases for the merge semantics where
// `false` must not turn a module into a banned one.
//
//  1. Run each override against every style of `node:util`.
//  2. Assert the unrestricted overrides yield zero findings.
//  3. Assert the swapped policy reports named imports with the swapped
//     message.
//
// @evidence contracts/testing.md#behavioral-verification The engine checks unrestricted false/empty inherited policies and exact swapped-policy findings.
// @evidence contracts/testing.md#independent-expectations The supported merge contract independently distinguishes disabling a module policy from banning all four explicit styles.
// @evidence contracts/testing.md#distinguishing-cases util false and named false are clean; explicit default-only util and configured fs preserve report/clean counterparts.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleStyleOverridesReplaceInheritedFlags owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleStyleOverridesReplaceInheritedFlags(t *testing.T) {
  everyStyle := `import util from "node:util";
import * as util2 from "node:util";
import { foo } from "node:util";
void [util, util2, foo];
`
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    everyStyle,
    `{"styles": {"util": false}}`,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    everyStyle,
    `{"styles": {"util": {"named": false}}}`,
  )

  findings := runUnicornImportStyleFindings(
    t,
    "import { promisify } from \"node:util\";\nvoid promisify;\n",
    `{"styles": {"util": {"default": true, "named": false}}}`,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `import { promisify } from "node:util";`,
    message: "Use default import for module `node:util`.",
  })

  findings = runUnicornImportStyleFindings(
    t,
    "import * as fs from \"node:fs\";\nvoid fs;\n",
    `{"styles": {"fs": {"default": true}}}`,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `import * as fs from "node:fs";`,
    message: "Use default import for module `node:fs`.",
  })
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    "import * as fs from \"node:fs\";\nvoid fs;\n",
    `{"styles": {"fs": {"namespace": true}}}`,
  )
}
