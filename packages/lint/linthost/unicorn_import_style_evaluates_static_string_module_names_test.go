package linthost

import (
  "testing"
)

// TestUnicornImportStyleEvaluatesStaticStringModuleNames verifies the
// static-string evaluator behind module resolution: literal
// concatenation, `node:` assembled from parts, template literals, and
// templates with static substitutions all resolve, while expressions
// with non-static parts stay silent.
//
// The native evaluator resolves literal concatenation and template parts;
// these four authored spellings independently establish the module text the
// rule must use. Identifier-dependent module text remains unknown.
//
//  1. Require `util` through four static spellings under default
//     options.
//  2. Assert each resolves to the util policy with the right module
//     spelling in the message.
//  3. Assert a concatenation with an identifier reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The engine checks four authored resolved-module messages/ranges and a nonstatic clean expression.
// @evidence contracts/testing.md#independent-expectations Supported static-string evaluation independently resolves concatenation and literal template substitutions, while identifier-dependent text is unknown.
// @evidence contracts/testing.md#distinguishing-cases Static util/node:util concatenations and templates report; an identifier-dependent concatenation is clean.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleEvaluatesStaticStringModuleNames owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleEvaluatesStaticStringModuleNames(t *testing.T) {
  source := "require('ut' + 'il');\n" +
    "require('node:' + 'util');\n" +
    "require(`util`);\n" +
    "const u = require(`${'ut'}${'il'}`);\n" +
    "void u;\n"
  findings := runUnicornImportStyleFindings(t, source, "")
  assertUnicornImportStyleFindings(
    t,
    findings,
    unicornImportStyleFinding{
      target:  "require('ut' + 'il')",
      message: "Use named import for module `util`.",
    },
    unicornImportStyleFinding{
      target:  "require('node:' + 'util')",
      message: "Use named import for module `node:util`.",
    },
    unicornImportStyleFinding{
      target:  "require(`util`)",
      message: "Use named import for module `util`.",
    },
    unicornImportStyleFinding{
      target:  "u = require(`${'ut'}${'il'}`)",
      message: "Use named import for module `util`.",
    },
  )

  assertRuleSkipsSource(t, unicornImportStyleRuleName, `declare const il: string;
require("ut" + il);
`)
}
