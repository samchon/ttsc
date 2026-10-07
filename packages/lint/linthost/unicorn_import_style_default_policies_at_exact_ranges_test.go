package linthost

import (
  "testing"
)

// TestUnicornImportStyleDefaultPoliciesAtExactRanges verifies the
// built-in table without options: `util` rejects default and namespace
// imports, `chalk` rejects named imports, and `node:` specifiers keep
// their spelling in the diagnostic while inheriting the bare policy.
//
// Independent literal messages and whole-declaration source ranges establish
// the expected diagnostics, including the original `node:` module spelling.
//
//  1. Run the rule with no options over six violations and four
//     compliant twins.
//  2. Assert finding order, exact source ranges, and exact messages.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution checks six findings in order with full authored declaration ranges and messages.
// @evidence contracts/testing.md#independent-expectations The supported default module policies and node-prefix inheritance independently determine literal styles, module spelling and message text.
// @evidence contracts/testing.md#distinguishing-cases Six disallowed imports (three util, two chalk, one node:path) contrast with four allowed twins: named util, default chalk, `default as` chalk and default path; the node:-prefixed specifiers appear only among the violations.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleDefaultPoliciesAtExactRanges owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleDefaultPoliciesAtExactRanges(t *testing.T) {
  source := `import util from "util";
import * as util2 from "util";
import util3 from "node:util";
import { red } from "chalk";
import { red as green } from "chalk";
import * as path from "node:path";
import { inspect } from "util";
import chalk from "chalk";
import { default as chalk2 } from "chalk";
import path2 from "path";
void [util, util2, util3, red, green, path, inspect, chalk, chalk2, path2];
`
  findings := runUnicornImportStyleFindings(t, source, "")
  assertUnicornImportStyleFindings(
    t,
    findings,
    unicornImportStyleFinding{
      target:  `import util from "util";`,
      message: "Use named import for module `util`.",
    },
    unicornImportStyleFinding{
      target:  `import * as util2 from "util";`,
      message: "Use named import for module `util`.",
    },
    unicornImportStyleFinding{
      target:  `import util3 from "node:util";`,
      message: "Use named import for module `node:util`.",
    },
    unicornImportStyleFinding{
      target:  `import { red } from "chalk";`,
      message: "Use default import for module `chalk`.",
    },
    unicornImportStyleFinding{
      target:  `import { red as green } from "chalk";`,
      message: "Use default import for module `chalk`.",
    },
    unicornImportStyleFinding{
      target:  `import * as path from "node:path";`,
      message: "Use default import for module `node:path`.",
    },
  )
}
