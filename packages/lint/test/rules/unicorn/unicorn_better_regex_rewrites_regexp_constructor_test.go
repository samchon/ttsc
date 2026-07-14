package linthost

import "testing"

// TestUnicornBetterRegexRewritesRegexpConstructor verifies the
// `new RegExp("pattern", "flags")` string-argument branch: the clean-regexp
// shorthand table rewrites the pattern in place, re-escaped for its original
// quote style.
//
// The constructor branch only handles a bare `new RegExp(...)` whose first
// argument is a string literal; the fix replaces just that argument and
// preserves its quote character (jsesc minimal escaping). A regex-literal
// first argument is optimized by the literal branch on the inner node instead.
// The negatives pin every disqualifier upstream honors — plain call, wrong
// callee, member callee, non-string / numeric / missing argument, and an
// already-optimal pattern.
//
//  1. Assert qualifying constructors rewrite their pattern argument.
//  2. Assert `new RegExp(/[0-9]/)` rewrites via the inner literal.
//  3. Assert disqualified and already-optimal forms do not fire.
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
