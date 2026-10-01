package linthost

import (
  "testing"
)

// TestUnicornImportStyleAcceptsMixedStylesWhenAllAllowed verifies that
// a reference carrying several actual styles is compliant when every
// one of them is allowed: `import util, {inspect}` under a module that
// allows both named and default.
//
// The report predicate is `every actual ∈ allowed`; asserting the
// two-style positive prevents an accidental `some` in the port.
//
//  1. Allow named and default for one module.
//  2. Import both styles in one declaration.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification The real engine accepts one declaration containing both configured named and default styles.
// @evidence contracts/testing.md#independent-expectations The supported every-style predicate independently permits a mixed import only when both styles are allowed.
// @evidence contracts/testing.md#distinguishing-cases The allowed mixed declaration is clean; NamedModulePolicyMatrix owns the same mixed shape with default disallowed.
// @evidence contracts/testing.md#execution-ownership TestUnicornImportStyleAcceptsMixedStylesWhenAllAllowed owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestUnicornImportStyleAcceptsMixedStylesWhenAllAllowed(t *testing.T) {
  assertRuleSkipsSourceWithOptions(t, unicornImportStyleRuleName, `import util, { inspect } from "named-or-default";
void [util, inspect];
`, `{"styles": {"named-or-default": {"named": true, "default": true}}}`)
}
