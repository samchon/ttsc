package linthost

import (
  "encoding/json"
  "strings"
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

// Valid: parseInt without a radix already yields a base-10 integer.
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
// fixture end-to-end against the native Engine.
//
// The rule resolves bindings through the checker, so the fixture is loaded with
// a real Program: locally shadowed `isNaN` / `parseInt`, base-10 and no-radix
// `parseInt` calls, and default-off `-Infinity` stay silent, while `parseInt(x,
// 2)` and the value positions of `{normalize: parseFloat, parseInt}` report.
//
// 1. Parse the fixture's `// expect:` annotations.
// 2. Run the rule through the checker-backed snapshot path.
// 3. Assert the Engine reports exactly the annotated diagnostics.
func TestRuleCorpusUnicornPreferNumberProperties(t *testing.T) {
  source := unicornPreferNumberPropertiesCorpusSource
  expected := parseRuleExpectations(t, source)
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
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

// TestUnicornPreferNumberPropertiesInterpolatesMessage pins the regression this
// fix targets: the message substitutes the real spellings rather than emitting
// the literal `<X>` placeholders the old port shipped.
func TestUnicornPreferNumberPropertiesInterpolatesMessage(t *testing.T) {
  source := "export {};\nconst raw = \"10\";\nvoid parseInt(raw, 2);\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %+v", findings)
  }
  want := "Prefer `Number.parseInt` over `parseInt`."
  if findings[0].Message != want {
    t.Fatalf("message not interpolated: want %q, got %q", want, findings[0].Message)
  }
  if strings.Contains(findings[0].Message, "<X>") {
    t.Fatalf("message still carries the literal placeholder: %q", findings[0].Message)
  }
}

// TestUnicornPreferNumberPropertiesReportsObjectValuePositions locks the
// dropped-value-position bug: the initializer of a property (`parseFloat`) and a
// shorthand (`parseInt`) are both references and must each report.
func TestUnicornPreferNumberPropertiesReportsObjectValuePositions(t *testing.T) {
  source := "export {};\nconst options = { normalize: parseFloat, parseInt };\nvoid options;\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  if len(findings) != 2 {
    t.Fatalf("want findings for parseFloat and parseInt, got %+v", findings)
  }
  messages := map[string]bool{}
  for _, finding := range findings {
    messages[finding.Message] = true
  }
  for _, want := range []string{
    "Prefer `Number.parseFloat` over `parseFloat`.",
    "Prefer `Number.parseInt` over `parseInt`.",
  } {
    if !messages[want] {
      t.Fatalf("missing %q in %+v", want, findings)
    }
  }
}

// TestUnicornPreferNumberPropertiesSkipsBase10AndMissingRadix keeps the
// no-radix and base-10 parseInt calls valid while pinning the radix-2 twin so an
// over-eager relaxation of the filter is caught.
func TestUnicornPreferNumberPropertiesSkipsBase10AndMissingRadix(t *testing.T) {
  for _, source := range []string{
    "export {};\nconst raw = \"10\";\nvoid parseInt(raw);\n",
    "export {};\nconst raw = \"10\";\nvoid parseInt(raw, 10);\n",
  } {
    _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
    if len(findings) != 0 {
      t.Fatalf("base-10 / no-radix parseInt must be valid, got %+v for %q", findings, source)
    }
  }
  source := "export {};\nconst raw = \"10\";\nvoid parseInt(raw, 2);\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  if len(findings) != 1 {
    t.Fatalf("radix-2 parseInt must fire, got %+v", findings)
  }
}

// TestUnicornPreferNumberPropertiesSkipsShadowedBindings verifies a locally
// declared or destructured binding of a tracked name is treated as a distinct
// value, so neither the shadowed `isNaN` call nor the shadowed `parseInt` fires.
func TestUnicornPreferNumberPropertiesSkipsShadowedBindings(t *testing.T) {
  source := `export {};
const value: unknown = 0;
{
  const isNaN = (input: unknown): boolean => input !== input;
  void isNaN(value);
}
{
  const { parseInt } = Number;
  void parseInt("10", 2);
}
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  if len(findings) != 0 {
    t.Fatalf("shadowed bindings must not fire, got %+v", findings)
  }
}

// TestUnicornPreferNumberPropertiesLeavesInfinityAndNaNUnderDefaults confirms
// both constants stay unchecked with the default options (both false).
func TestUnicornPreferNumberPropertiesLeavesInfinityAndNaNUnderDefaults(t *testing.T) {
  source := "export {};\nconst values = [Infinity, -Infinity, NaN];\nvoid values;\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  if len(findings) != 0 {
    t.Fatalf("Infinity and NaN are off by default, got %+v", findings)
  }
}

// TestUnicornPreferNumberPropertiesChecksInfinityWhenEnabled proves the opt-in
// path maps positive and negated Infinity to their distinct property names and
// interpolates the negated description.
func TestUnicornPreferNumberPropertiesChecksInfinityWhenEnabled(t *testing.T) {
  source := "export {};\nconst positive = Infinity;\nconst negative = -Infinity;\nvoid [positive, negative];\n"
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreferNumberPropertiesRuleName,
    source,
    json.RawMessage(`{"checkInfinity":true}`),
  )
  if len(findings) != 2 {
    t.Fatalf("checkInfinity should report both, got %+v", findings)
  }
  messages := map[string]bool{}
  for _, finding := range findings {
    messages[finding.Message] = true
  }
  for _, want := range []string{
    "Prefer `Number.POSITIVE_INFINITY` over `Infinity`.",
    "Prefer `Number.NEGATIVE_INFINITY` over `-Infinity`.",
  } {
    if !messages[want] {
      t.Fatalf("missing %q in %+v", want, findings)
    }
  }
}

// TestUnicornPreferNumberPropertiesChecksNaNWhenEnabled proves the opt-in NaN
// path reports with the substituted `Number.NaN` message.
func TestUnicornPreferNumberPropertiesChecksNaNWhenEnabled(t *testing.T) {
  source := "export {};\nconst value = NaN;\nvoid value;\n"
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreferNumberPropertiesRuleName,
    source,
    json.RawMessage(`{"checkNaN":true}`),
  )
  if len(findings) != 1 || findings[0].Message != "Prefer `Number.NaN` over `NaN`." {
    t.Fatalf("checkNaN mismatch: %+v", findings)
  }
}

// TestUnicornPreferNumberPropertiesAutofixesSafeGlobal proves a pure-alias
// global carries an automatic fix.
func TestUnicornPreferNumberPropertiesAutofixesSafeGlobal(t *testing.T) {
  assertFixSnapshot(
    t,
    unicornPreferNumberPropertiesRuleName,
    "export {};\nconst raw = \"10\";\nconst n = parseInt(raw, 2);\nvoid n;\n",
    "export {};\nconst raw = \"10\";\nconst n = Number.parseInt(raw, 2);\nvoid n;\n",
  )
}

// TestUnicornPreferNumberPropertiesExpandsShorthandFix proves the shorthand
// value is expanded to a full property so the fix stays valid syntax.
func TestUnicornPreferNumberPropertiesExpandsShorthandFix(t *testing.T) {
  assertFixSnapshot(
    t,
    unicornPreferNumberPropertiesRuleName,
    "export {};\nconst o = { parseInt };\nvoid o;\n",
    "export {};\nconst o = { parseInt: Number.parseInt };\nvoid o;\n",
  )
}

// TestUnicornPreferNumberPropertiesAutofixesIsNaNWithNumberArgument proves the
// otherwise suggestion-only isNaN autofixes when its sole argument is a number.
func TestUnicornPreferNumberPropertiesAutofixesIsNaNWithNumberArgument(t *testing.T) {
  assertFixSnapshot(
    t,
    unicornPreferNumberPropertiesRuleName,
    "export {};\nvoid isNaN(0);\n",
    "export {};\nvoid Number.isNaN(0);\n",
  )
}

// TestUnicornPreferNumberPropertiesSuggestsUnsafeIsNaN proves that isNaN with a
// non-number argument reports with a suggestion instead of an unsafe autofix,
// because Number.isNaN would change the runtime result.
func TestUnicornPreferNumberPropertiesSuggestsUnsafeIsNaN(t *testing.T) {
  source := "export {};\ndeclare const input: any;\nvoid isNaN(input);\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %+v", findings)
  }
  if len(findings[0].Fix) != 0 {
    t.Fatalf("unsafe isNaN must not carry an automatic fix, got %+v", findings[0].Fix)
  }
  if len(findings[0].Suggestions) != 1 ||
    findings[0].Suggestions[0].Title != "Replace `isNaN` with `Number.isNaN`." {
    t.Fatalf("suggestion mismatch: %+v", findings[0].Suggestions)
  }
}

// TestUnicornPreferNumberPropertiesFixesNegativeInfinity proves the negated
// Infinity fix rewrites the whole unary to Number.NEGATIVE_INFINITY.
func TestUnicornPreferNumberPropertiesFixesNegativeInfinity(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    unicornPreferNumberPropertiesRuleName,
    "export {};\nconst negative = -Infinity;\nvoid negative;\n",
    `{"checkInfinity":true}`,
    "export {};\nconst negative = Number.NEGATIVE_INFINITY;\nvoid negative;\n",
  )
}

// TestUnicornPreferNumberPropertiesValidatesOptions locks the public option
// schema: only the boolean checkInfinity / checkNaN keys are accepted, and the
// checker requirement survives every valid shape.
func TestUnicornPreferNumberPropertiesValidatesOptions(t *testing.T) {
  valid := []json.RawMessage{
    nil,
    json.RawMessage(`{}`),
    json.RawMessage(`{"checkInfinity":true}`),
    json.RawMessage(`{"checkNaN":false}`),
    json.RawMessage(`{"checkInfinity":true,"checkNaN":true}`),
  }
  for _, options := range valid {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornPreferNumberPropertiesRuleName: SeverityError},
      Options: RuleOptionsMap{unicornPreferNumberPropertiesRuleName: options},
    })
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("valid options %s were rejected: %v", options, err)
    }
    if !engine.NeedsTypeChecker() {
      t.Fatalf("valid options %s lost the checker requirement", options)
    }
  }

  invalid := []struct {
    options json.RawMessage
    want    string
  }{
    {options: json.RawMessage(`null`), want: "options must be an object"},
    {options: json.RawMessage(`[]`), want: "options must be an object"},
    {options: json.RawMessage(`{"checkInfinity":null}`), want: `option "checkInfinity" must be a boolean`},
    {options: json.RawMessage(`{"checkNaN":"yes"}`), want: `option "checkNaN" must be a boolean`},
    {options: json.RawMessage(`{"unknown":true}`), want: `unknown option "unknown"`},
  }
  for _, test := range invalid {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornPreferNumberPropertiesRuleName: SeverityError},
      Options: RuleOptionsMap{unicornPreferNumberPropertiesRuleName: test.options},
    })
    err := engine.ConfigError()
    if err == nil || !strings.Contains(err.Error(), test.want) {
      t.Fatalf("invalid options %s mismatch: want %q, got %v", test.options, test.want, err)
    }
    if _, active := engine.EnabledRules()[unicornPreferNumberPropertiesRuleName]; active {
      t.Fatalf("invalid options entered the dispatch table: %v", engine.EnabledRules())
    }
  }
}
