package linthost

import "testing"

const unicornEscapeCaseRuleName = "unicorn/escape-case"

// TestRuleCorpusUnicornEscapeCase verifies the corpus fixture: every active
// escape whose hex digits carry an a-f letter reports while canonical
// escapes, escaped backslashes, and tagged templates stay silent.
//
// The parser decodes escapes into `.Text`, so the rule reads raw source via
// `nodeText`; this fixture pins that raw-source path across string literals,
// the head/middle/tail elements of substituted templates, the
// backslash-parity boundary, and the fixed digit widths that keep a canonical
// escape from absorbing the literal `a-f` letters typed behind it.
//
// 1. Mirror tests/test-lint/src/cases/unicorn-escape-case.ts.
// 2. Run the native engine with the rule enabled via expect annotations.
// 3. Assert the reported (rule, severity, line) triples match the annotations.
func TestRuleCorpusUnicornEscapeCase(t *testing.T) {
  assertRuleCorpusCase(
    t,
    "unicorn/escape-case.ts",
    "// expect: unicorn/escape-case error\n"+
      "const s = \"\\xa9\";\n"+
      "// expect: unicorn/escape-case error\n"+
      "const lowercaseUnicode = \"\\uabcd\";\n"+
      "// expect: unicorn/escape-case error\n"+
      "const lowercaseCodePoint = \"\\u{1f600}\";\n"+
      "// expect: unicorn/escape-case error\n"+
      "const oddBackslashRun = \"\\\\\\xa9\";\n"+
      "// expect: unicorn/escape-case error\n"+
      "const head = `\\xa9${s}`;\n"+
      "// expect: unicorn/escape-case error\n"+
      "const middle = `${s}\\xa9${s}`;\n"+
      "// expect: unicorn/escape-case error\n"+
      "const tail = `${s}\\xa9`;\n"+
      "const canonicalHex = \"\\xA9\";\n"+
      "const canonicalUnicode = \"\\uABCD\";\n"+
      "const canonicalCodePoint = \"\\u{1F600}\";\n"+
      "const boundedHex = \"\\x41bcd\";\n"+
      "const boundedUnicode = \"\\uABCDdef\";\n"+
      "const escapedBackslash = \"\\\\xa9\";\n"+
      "const evenBackslashRun = \"\\\\\\\\xa9\";\n"+
      "const tagged = String.raw`\\xa9`;\n"+
      "export default [\n"+
      "  s,\n"+
      "  lowercaseUnicode,\n"+
      "  lowercaseCodePoint,\n"+
      "  oddBackslashRun,\n"+
      "  head,\n"+
      "  middle,\n"+
      "  tail,\n"+
      "  canonicalHex,\n"+
      "  canonicalUnicode,\n"+
      "  canonicalCodePoint,\n"+
      "  boundedHex,\n"+
      "  boundedUnicode,\n"+
      "  escapedBackslash,\n"+
      "  evenBackslashRun,\n"+
      "  tagged,\n"+
      "];\n",
  )
}
