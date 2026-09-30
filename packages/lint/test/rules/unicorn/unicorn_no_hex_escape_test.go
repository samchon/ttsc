package linthost

import "testing"

const unicornNoHexEscapeRuleName = "unicorn/no-hex-escape"

// TestRuleCorpusUnicornNoHexEscape verifies the corpus fixture: every active
// `\xHH` escape reports while Unicode escapes, escaped backslashes, and
// tagged templates stay silent.
//
// The parser decodes escapes into `.Text`, so the rule reads raw source via
// `nodeText`; this fixture pins that raw-source path across string literals,
// the head/middle/tail elements of substituted templates, and the
// backslash-parity boundary that separates a genuine escape from an escaped
// backslash followed by hex-looking text.
//
// 1. Mirror tests/test-lint/src/cases/unicorn-no-hex-escape.ts.
// 2. Run the native engine with the rule enabled via expect annotations.
// 3. Assert the reported (rule, severity, line) triples match the annotations.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase runs the actual engine and compares exact annotated rule/severity/line triples for five active hex-escape sites.
// @evidence contracts/testing.md#independent-expectations The supported Unicode escape preference and JavaScript backslash pairing establish authored expected locations without consulting findings.
// @evidence contracts/testing.md#distinguishing-cases String and substituted-template escapes report; Unicode forms, even slash runs and raw tagged templates remain clean in the same source.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoHexEscape owns the explicit source matrix and any named t.Run variants as one discoverable Go unit entry. Parsing and actual engine calls share the Go test process; no installed consumer, native compilation or child product host is needed.
func TestRuleCorpusUnicornNoHexEscape(t *testing.T) {
  assertRuleCorpusCase(
    t,
    "unicorn/no-hex-escape.ts",
    "// expect: unicorn/no-hex-escape error\n"+
      "const s = \"\\xA9\";\n"+
      "// expect: unicorn/no-hex-escape error\n"+
      "const oddBackslashRun = \"\\\\\\x41\";\n"+
      "// expect: unicorn/no-hex-escape error\n"+
      "const head = `\\xA9${s}`;\n"+
      "// expect: unicorn/no-hex-escape error\n"+
      "const middle = `${s}\\xA9${s}`;\n"+
      "// expect: unicorn/no-hex-escape error\n"+
      "const tail = `${s}\\xA9`;\n"+
      "const escapedBackslash = \"\\\\x64\";\n"+
      "const evenBackslashRun = \"\\\\\\\\x64\";\n"+
      "const unicodeEscape = \"\\u00A9\";\n"+
      "const codePointEscape = \"\\u{1F600}\";\n"+
      "const tagged = String.raw`\\xA9`;\n"+
      "export default [\n"+
      "  s,\n"+
      "  oddBackslashRun,\n"+
      "  head,\n"+
      "  middle,\n"+
      "  tail,\n"+
      "  escapedBackslash,\n"+
      "  evenBackslashRun,\n"+
      "  unicodeEscape,\n"+
      "  codePointEscape,\n"+
      "  tagged,\n"+
      "];\n",
  )
}
