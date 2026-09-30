package linthost

import "testing"

// TestRuleCorpusUnicornTextEncodingIdentifierCase mirrors the end-to-end corpus
// fixture through the native rule engine: the dash-less `utf8` and `ascii` are
// canonical, while `"utf-8"`, `"ASCII"`, and a dash-required
// `new TextDecoder("utf8")` each report exactly once.
//
// The fixture pairs every positive with a negative twin one property away
// (`"utf-8"` invalid vs `"utf8"` valid, `"ASCII"` invalid vs `"ascii"` valid,
// `new TextDecoder("utf8")` invalid vs `new TextDecoder("utf-8")` valid) plus
// two unknown labels (`"latin1"`, `"UTF-16LE"`) the rule must ignore, so the
// upstream-inverting bug in issue #596 cannot hide behind a single fixture.
//
//  1. Enable unicorn/text-encoding-identifier-case via expect annotations.
//  2. Run the engine on the mixed valid/invalid corpus.
//  3. Assert exactly the three annotated findings.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase requires exactly three encoding-label diagnostics and no extra findings.
// @evidence contracts/testing.md#independent-expectations Authored annotations encode upstream default dashless utf8/lowercase ascii and context-specific dashed TextDecoder spelling.
// @evidence contracts/testing.md#distinguishing-cases utf-8/ASCII and decoder utf8 report; ordinary utf8/ascii, unknown latin1/UTF-16LE and decoder utf-8 remain accepted.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornTextEncodingIdentifierCase is a discoverable Go unit host; its source/option fixtures exercise owning AST engine and fix operations in the shared Go process without consumer installation, native builds or product child hosts. Helper failures retain the source/expected fixture identity.
func TestRuleCorpusUnicornTextEncodingIdentifierCase(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/text-encoding-identifier-case.ts", "// unicorn/text-encoding-identifier-case corpus. Upstream's canonical form is\n// the dash-less `utf8` by default; the dashed `utf-8` is enforced only where a\n// context demands it (here `new TextDecoder(...)`). Only `utf-8`/`utf8` and\n// `ascii` are handled — every other encoding label passes through untouched.\n\n// expect: unicorn/text-encoding-identifier-case error\nconst dashed = \"utf-8\";\nconst dashless = \"utf8\";\n// expect: unicorn/text-encoding-identifier-case error\nconst upperAscii = \"ASCII\";\nconst lowerAscii = \"ascii\";\nconst latin = \"latin1\";\nconst utf16 = \"UTF-16LE\";\n// expect: unicorn/text-encoding-identifier-case error\nconst decoder = new TextDecoder(\"utf8\");\nconst dashedDecoder = new TextDecoder(\"utf-8\");\nvoid [dashed, dashless, upperAscii, lowerAscii, latin, utf16, decoder, dashedDecoder];\n")
}
