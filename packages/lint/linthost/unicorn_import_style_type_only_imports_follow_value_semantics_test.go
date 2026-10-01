package linthost

import (
  "testing"
)

// TestUnicornImportStyleTypeOnlyImportsFollowValueSemantics verifies
// upstream's TypeScript cases: type-only imports classify exactly like
// value imports — a default type import of `chalk` passes while named
// type imports (inline or clause-level) are reported.
//
// The rule reads specifier shape only; an accidental type-only
// exemption would silently unlock named imports of default-only
// modules.
//
//  1. Run type-only positives and negatives against the default table
//     and the named policy module.
//  2. Assert the two named type imports of `chalk` are reported.
//  3. Assert the compliant type imports stay silent.
//
// @evidence contracts/testing.md#behavioral-verification The actual rule reports both retained named type imports and accepts compliant type-only forms.
// @evidence contracts/testing.md#independent-expectations The supported specifier-shape policy independently applies to type-only imports without a blanket exemption.
// @evidence contracts/testing.md#distinguishing-cases Default chalk type and named-policy type imports are clean; inline/clause named chalk types report.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleTypeOnlyImportsFollowValueSemantics owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleTypeOnlyImportsFollowValueSemantics(t *testing.T) {
  assertRuleSkipsSource(t, unicornImportStyleRuleName, `import type chalk from "chalk";
void 0;
`)
  assertRuleSkipsSourceWithOptions(
    t,
    unicornImportStyleRuleName,
    "import type { x } from \"named\";\nvoid 0;\n",
    unicornImportStylePolicyOptions,
  )

  source := `import { type ChalkInstance } from "chalk";
import type { ChalkOptions } from "chalk";
void 0;
`
  findings := runUnicornImportStyleFindings(t, source, "")
  assertUnicornImportStyleFindings(
    t,
    findings,
    unicornImportStyleFinding{
      target:  `import { type ChalkInstance } from "chalk";`,
      message: "Use default import for module `chalk`.",
    },
    unicornImportStyleFinding{
      target:  `import type { ChalkOptions } from "chalk";`,
      message: "Use default import for module `chalk`.",
    },
  )
}
