package linthost

import (
  "testing"
)

const unicornPreferNumberPropertiesRuleName = "unicorn/prefer-number-properties"

// unicornPreferNumberPropertiesCorpusSource mirrors
// tests/test-lint/src/cases/unicorn-prefer-number-properties.ts so the Go layer
// and the end-to-end corpus assert the same default-option behavior: base-10 /
// no-radix parseInt calls and locally shadowed bindings are valid, while a
// radix-2 parseInt and both value positions of an object literal
// (`{normalize: parseFloat, parseInt}`) are reported.
const unicornPreferNumberPropertiesCorpusSource = `export {};

const raw = "10";
const value: unknown = 0;

// Valid: the no-radix parseInt policy permits this decimal input.
void parseInt(raw);

// Valid: an explicit base-10 radix is equally redundant.
void parseInt(raw, 10);

// expect: unicorn/prefer-number-properties error
void parseInt(raw, 2);

// expect: unicorn/prefer-number-properties error
// expect: unicorn/prefer-number-properties error
const options = { normalize: parseFloat, parseInt };
void options;

// Valid: a locally shadowed isNaN is a different function.
{
  const isNaN = (input: unknown): boolean => input !== input;
  void isNaN(value);
}

// Valid: parseInt destructured from Number is a local binding.
{
  const { parseInt } = Number;
  void parseInt(raw, 2);
}

// Valid: -Infinity is left untouched unless checkInfinity is enabled.
const negative = -Infinity;
void negative;
`

// TestRuleCorpusUnicornPreferNumberProperties verifies the shared corpus
// fixture through the checker-backed Go Engine.
//
// The rule resolves bindings through the checker, so the fixture is loaded with
// a real Program: locally shadowed `isNaN` / `parseInt`, base-10 and no-radix
// `parseInt` calls, and default-off `-Infinity` stay silent, while `parseInt(x,
// 2)` and the value positions of `{normalize: parseFloat, parseInt}` report.
//
// 1. Parse the fixture's `// expect:` annotations.
// 2. Run the rule through the checker-backed snapshot path.
// 3. Assert the Engine reports exactly the annotated diagnostics.
//
// 1. Execute the retained source and option variants through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed NewEngine.Run compares the actual corpus diagnostics with annotated rule/severity/line triples, distinguishing global numeric references from relaxed or shadowed uses.
// @evidence contracts/testing.md#independent-expectations Authored error annotations independently require radix-2 parseInt and object value references to report while the documented default policy accepts decimal/no-radix, local bindings and default-off Infinity.
// @evidence contracts/testing.md#distinguishing-cases The original mixed corpus retains base-10/no-radix calls, radix 2, property/shorthand references, lexical shadows and default-off negative Infinity.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferNumberProperties owns these literal variants as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestRuleCorpusUnicornPreferNumberProperties(t *testing.T) {
  source := unicornPreferNumberPropertiesCorpusSource
  expected := parseRuleExpectations(t, source)
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornPreferNumberPropertiesRuleName, findings)
  if len(findings) != len(expected) {
    t.Fatalf("unicorn-prefer-number-properties.ts: want %v, got %+v", expected, findings)
  }
  actual := normalizeRuleFindings(findings[0].File, findings)
  for index := range expected {
    if actual[index] != expected[index] {
      t.Fatalf("unicorn-prefer-number-properties.ts[%d]: want %+v, got %+v; all=%+v", index, expected[index], actual[index], actual)
    }
  }
}
