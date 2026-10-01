package linthost

import (
  "testing"
)

// TestUnicornImportStyleObjectPatternKeyForms verifies the
// binding-target classifier's key handling: identifier keys classify
// by name, computed identifier keys count as named, and literal keys
// contribute no style at all (leaving the reference compliant).
//
// Upstream checks `property.key.type === 'Identifier'` without a
// computed guard, so `{[key]: x}` is named while `{"literal": x}` and
// `{0: x}` are unclassified — asymmetries worth pinning.
//
//  1. Destructure `named` and `default` policy modules with each key
//     form.
//  2. Assert literal keys stay silent even under the default-only
//     policy.
//  3. Assert computed identifier keys count as named.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution compares object-binding key forms with authored clean and exact reported results.
// @evidence contracts/testing.md#independent-expectations The supported Identifier-key classifier independently includes computed identifier keys but excludes literal string/number keys.
// @evidence contracts/testing.md#distinguishing-cases Literal keys and named-policy computed keys are clean; the computed identifier under default-only policy reports.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleObjectPatternKeyForms owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleObjectPatternKeyForms(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `declare const key: string;
const { "literal": a } = require("default");
const { 0: b } = require("default");
const { [key]: c } = require("named");
void [a, b, c];
`, unicornImportStylePolicyOptions)

  findings := runUnicornImportStyleFindings(
    t,
    `declare const key: string;
const { [key]: c } = require("default");
void c;
`,
    unicornImportStylePolicyOptions,
  )
  assertUnicornImportStyleFindings(t, findings, unicornImportStyleFinding{
    target:  `{ [key]: c } = require("default")`,
    message: "Use default import for module `default`.",
  })
}
