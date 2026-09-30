package linthost

import (
  "testing"
)

// TestUnicornImportStyleDefaultPoliciesSkipCompliantAndUnknownModules
// verifies the negative space of the default table: compliant styles,
// modules missing from the table, and `node:` builtins without a
// configured bare name produce no findings at all.
//
// An over-matching port would flag unaffected modules; this pins the
// module lookup to exact (prefix-stripped) names.
//
//  1. Import every default-table module in its allowed style.
//  2. Import unrelated modules in every style.
//  3. Assert zero findings under default options.
//
// @evidence contracts/testing.md#behavioral-verification The real engine requires silence for every retained compliant or unconfigured module import.
// @evidence contracts/testing.md#independent-expectations Exact prefix-stripped policy lookup independently leaves unknown modules and unconfigured builtins unrestricted.
// @evidence contracts/testing.md#distinguishing-cases Allowed util/chalk/path imports, fs forms, fs/promises, unknown builtins and lodash stay clean; the exact-range host owns violations.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleDefaultPoliciesSkipCompliantAndUnknownModules owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleDefaultPoliciesSkipCompliantAndUnknownModules(t *testing.T) {
  assertRuleSkipsSource(t, unicornImportStyleRuleName, `import { inspect } from "util";
import { promisify as promise } from "node:util";
import chalk from "chalk";
import path from "path";
import nodePath from "node:path";
import fs from "node:fs";
import * as fs2 from "node:fs";
import { readFile } from "node:fs";
import fsPromises from "node:fs/promises";
import unknown from "node:unknown";
import lodash from "lodash";
void [inspect, promise, chalk, path, nodePath, fs, fs2, readFile, fsPromises, unknown, lodash];
`)
}
