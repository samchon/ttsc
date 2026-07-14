package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRegexpUselessIgnoreCaseFlag verifies regexp/no-useless-flag on the `i` flag.
//
// The `i` decision used to run on `scanRegexpPattern`, whose visit callback
// fires only outside a character class, so `/[a-z]/i` looked letter-free and the
// rule ordered a load-bearing flag deleted (issue #576). The predicate now walks
// the regexp AST, and the negatives below pin every shape that keeps the flag
// alive: class members and ranges, negated classes, escapes that decode to cased
// characters, non-ASCII and astral case pairs, letters reachable only through a
// group, and the Unicode-mode widening of `\w`/`\b`. The positives pin the other
// edge -- a genuinely dead `i` must still report -- so the fix cannot degenerate
// into "never report". Expectations follow eslint-plugin-regexp's
// `isCaseVariant(pattern, flags, /* wholeCharacterClass */ false)`, which judges
// a class element by element: `/[a-zA-Z]/i` keeps its flag even though the class
// already spans both cases.
//
//  1. Enable `regexp/no-useless-flag` on one regex literal per case.
//  2. Run the engine on each.
//  3. Assert the flag is reported only where toggling `i` cannot change a match.
func TestRegexpUselessIgnoreCaseFlag(t *testing.T) {
  cases := []struct {
    literal string
    report  bool
    reason  string
  }{
    // Dead `i`: nothing in the pattern can re-case.
    {`/\d+/i`, true, "digits only"},
    {`/^\d+$/i`, true, "anchors are case-invariant"},
    {`/[0-9]/i`, true, "a range of digits stays a range of digits"},
    {`/[^0-9]/i`, true, "negating a case-invariant class keeps it invariant"},
    {`/[\x30-\x39]/i`, true, "hex escapes decoding to digits"},
    {`/[\u4e00-\u9fa5]/i`, true, "no CJK ideograph has a case-folded counterpart"},
    {`/[\b]/i`, true, "inside a class \\b is the backspace character"},
    {`/\cA/i`, true, "\\cA is a control code point"},
    {`/\60/i`, true, "the legacy octal escape \\60 decodes to the digit 0"},
    {`/\8/i`, true, "Annex B \\8 matches the bare digit"},
    {`/\ud801\udc00/i`, true, "without u these are two caseless code units, not a code point"},
    {`/\w+/i`, true, "without u, \\w is [A-Za-z0-9_] with or without the flag"},
    {`/\b\d/i`, true, "without u, \\b is defined over that same \\w"},
    {`/(?<year>\d{4})/i`, true, "a group name is never matched against the input"},
    {`/(?:\d{2,4})?/i`, true, "groups and quantifiers contribute no characters"},
    {`/[\d\s]|[.,]/i`, true, "both alternatives are case-invariant"},
    {`/(?:)/i`, true, "an empty pattern matches no character at all"},

    // Live `i`: the flag widens what the pattern matches.
    {`/[a-z]/i`, false, "the reported regression: i extends [a-z] to A-Z"},
    {`/[A-Z]/i`, false, "and [A-Z] to a-z"},
    {`/[abc]/i`, false, "plain class members re-case too"},
    {`/^[a-z]+$/i`, false, "anchors and quantifiers do not hide the class"},
    {`/[^a-z]/i`, false, "negation does not make the letters go away"},
    {`/[a-zA-Z]/i`, false, "upstream judges a class element by element"},
    {`/[\x41]/i`, false, "an escape inside a class still decodes to A"},
    {`/\101/i`, false, "and the legacy octal escape \\101 decodes to A"},
    {`/\u0061/i`, false, "and \\u0061 decodes to a"},
    {`/[\u0061-\u007a]/i`, false, "an escaped range is still a-z"},
    {`/[\d-z]/i`, false, "Annex B reads [\\d-z] as \\d, -, z"},
    {`/(?:\d|x)/i`, false, "a letter reachable only through a group counts"},
    {`/[\u00e9]/i`, false, "e-acute pairs with E-acute even without the u flag"},
    {`/[\u017f]/i`, false, "conservative: legacy mode keeps U+017F apart from s"},
    {`/\u{10400}/iu`, false, "astral case pair: Deseret capital folds to small"},
    {`/\ud801\udc00/iu`, false, "the same code point spelled as a surrogate pair"},
    {`/[\u0300-\u036f]/iu`, false, "U+0345 inside the range folds to iota"},
    {`/\w/iu`, false, "under u, \\w gains U+017F and U+212A"},
    {`/\b\d/iu`, false, "so does the \\b defined over it"},
    {`/\p{Nd}/iu`, false, "conservative: property escapes are not fold-analyzed"},
    {`/(.)\1/i`, false, "i canonicalizes the backreference: /(.)\\1/i matches aA"},
    {`/(\d)\1/i`, false, "conservative: every backreference counts"},
    {`/[\q{ab}]/vi`, false, "the v-mode string ab re-cases to AB"},
    {`/[\u{20000}-\u{10FFFF}]/iu`, false, "conservative: a range this wide is not fold-scanned"},
    {`/\c/i`, false, "a dangling \\c matches the two characters \\ and c"},
  }
  for _, tc := range cases {
    source := "const value = " + tc.literal + ";\n"
    file := parseTS(t, source)
    findings := NewEngine(RuleConfig{
      "regexp/no-useless-flag": SeverityError,
    }).Run([]*shimast.SourceFile{file}, nil)
    actual := normalizeRuleFindings(file, findings)
    expected := []ruleExpectation{}
    if tc.report {
      expected = append(expected, ruleExpectation{
        Rule:     "regexp/no-useless-flag",
        Severity: SeverityError,
        Line:     1,
      })
    }
    // Errorf, not Fatalf: every case is independent, and a regression in the
    // predicate usually breaks a whole family of them at once.
    if len(actual) != len(expected) {
      t.Errorf("%s (%s): want %v, got %v", tc.literal, tc.reason, expected, actual)
      continue
    }
    for i := range expected {
      if actual[i] != expected[i] {
        t.Errorf("%s (%s): want %+v, got %+v", tc.literal, tc.reason, expected[i], actual[i])
      }
    }
    recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  }
}
