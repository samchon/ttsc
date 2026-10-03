package linthost

import "testing"

// TestUnicornBetterRegexRewritesRegexpConstructor verifies the
// `new RegExp("pattern", "flags")` string-argument branch: the clean-regexp
// shorthand table rewrites the pattern in place, re-escaped for its original
// quote style.
//
// The constructor branch only handles a bare `new RegExp(...)` whose first
// argument is a string literal; the fix replaces just that argument and
// preserves its quote character. A regex-literal first argument is optimized by
// the literal branch on the inner node instead.
// The negatives pin every disqualifier upstream honors — plain call, wrong
// callee, member callee, non-string / numeric / missing argument, and an
// already-optimal pattern.
//
//  1. Assert qualifying constructors rewrite their pattern argument.
//  2. Assert `new RegExp(/[0-9]/)` rewrites via the inner literal.
//  3. Assert disqualified and already-optimal forms do not fire.
//
// @evidence contracts/testing.md#behavioral-verification exact fix snapshots verify bare new RegExp string arguments and nested regex literals, while zero-finding controls reject unrelated call shapes.
// @evidence contracts/testing.md#independent-expectations The authored single/double quoted escaped string outputs and inner literal outputs follow upstream constructor policy and preserve flags/quote delimiters.
// @evidence contracts/testing.md#distinguishing-cases Single/double quotes, explicit flags and inner regex literals rewrite; plain calls, other/member callees, dynamic/numeric/missing patterns and canonical patterns do not.
// @evidence contracts/testing.md#execution-ownership All authored sources execute inside this named Go unit entry; the shared Go process runs owning operations without installing a consumer, building a native artifact or launching a product host.
func TestUnicornBetterRegexRewritesRegexpConstructor(t *testing.T) {
  assertFixSnapshot(
    t,
    unicornBetterRegexRuleName,
    "const foo = new RegExp('[0-9]');\n",
    "const foo = new RegExp('\\\\d');\n",
  )
  assertFixSnapshot(
    t,
    unicornBetterRegexRuleName,
    "const foo = new RegExp(\"[0-9]\");\n",
    "const foo = new RegExp(\"\\\\d\");\n",
  )
  assertFixSnapshot(
    t,
    unicornBetterRegexRuleName,
    "const foo = new RegExp('[0-9]', 'ig');\n",
    "const foo = new RegExp('\\\\d', 'ig');\n",
  )
  // Regex-literal argument: the literal branch fixes the inner node.
  assertFixSnapshot(
    t,
    unicornBetterRegexRuleName,
    "const foo = new RegExp(/[0-9]/, 'ig');\n",
    "const foo = new RegExp(/\\d/, 'ig');\n",
  )
  assertFixSnapshot(
    t,
    unicornBetterRegexRuleName,
    "const foo = new RegExp(/[0-9]/);\n",
    "const foo = new RegExp(/\\d/);\n",
  )

  for _, source := range []string{
    "const foo = RegExp('[0-9]');\n",          // not `new`
    "const foo = new Foo('[0-9]');\n",         // wrong callee
    "const foo = new foo.RegExp('[0-9]');\n",  // member callee
    "const foo = new RegExp(foo);\n",          // non-string pattern
    "const foo = new RegExp(0);\n",            // numeric pattern
    "const foo = new RegExp();\n",             // no arguments
    "const foo = new RegExp('[a-z]', 'i');\n", // already optimal
  } {
    assertRuleSkipsSource(t, unicornBetterRegexRuleName, source)
  }
}
