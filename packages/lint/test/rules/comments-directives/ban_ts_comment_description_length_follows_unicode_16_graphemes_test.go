package linthost

import (
  "encoding/json"
  "fmt"
  "testing"
)

// TestBanTsCommentDescriptionLengthFollowsUnicode16Graphemes verifies the
// real ban-ts-comment rule measures descriptions with complete UAX #29
// extended grapheme clusters.
//
// GB9b Prepend, GB9c Indic conjuncts, and category-Cf emoji tags were absent
// from the former approximation. Positive cases pin each no-break context;
// reversed, control, and missing-linker twins prevent broad joins, while an
// incomplete tag sequence proves tags extend clusters independent of emoji
// sequence completeness.
//
// 1. Run standards-derived positive and negative twins through the real rule.
// 2. Exercise custom two-cluster and default three-cluster thresholds.
// 3. Retain Hangul, marks, emoji ZWJ/modifier, and RI-pair coverage.
func TestBanTsCommentDescriptionLengthFollowsUnicode16Graphemes(t *testing.T) {
  const (
    ruleName = "typescript/ban-ts-comment"
    family   = "\U0001F468\u200D\U0001F469\u200D\U0001F467\u200D\U0001F466"
    england  = "\U0001F3F4\U000E0067\U000E0062\U000E0065\U000E006E\U000E0067\U000E007F"
  )
  twoClusterOptions := json.RawMessage(`{"minimumDescriptionLength": 2, "ts-expect-error": "allow-with-description"}`)

  testCases := []struct {
    name        string
    description string
    options     json.RawMessage
    wantFinding bool
  }{
    {name: "prepend before base", description: "\u0600a", options: twoClusterOptions, wantFinding: true},
    {name: "repeated prepend", description: "\u0600\u0600a", options: twoClusterOptions, wantFinding: true},
    {name: "reverse prepend", description: "a\u0600", options: twoClusterOptions},
    {name: "prepend before control", description: "\u0600\u0001", options: twoClusterOptions},
    {name: "prepend plus extend", description: "\u0600\u0301", options: twoClusterOptions, wantFinding: true},
    {name: "prepend base plus extend", description: "\u0600a\u0301", options: twoClusterOptions, wantFinding: true},
    {name: "prepend extend before base", description: "\u0600\u0301a", options: twoClusterOptions},

    {name: "indic consonant linker consonant", description: "\u0915\u094D\u0937", options: twoClusterOptions, wantFinding: true},
    {name: "indic extends around linker", description: "\u0915\u093C\u094D\u093C\u0937", options: twoClusterOptions, wantFinding: true},
    {name: "indic missing linker", description: "\u0915\u093C\u0937", options: twoClusterOptions},
    {name: "indic missing leading consonant", description: "\u094D\u0937", options: twoClusterOptions},
    {name: "indic linker before non consonant", description: "\u0915\u094Da", options: twoClusterOptions},

    {name: "complete emoji tag sequence", description: england, options: twoClusterOptions, wantFinding: true},
    {name: "incomplete emoji tag sequence", description: "\U0001F3F4\U000E0067\U000E0062", options: twoClusterOptions, wantFinding: true},
    {name: "reversed emoji tag", description: "\U000E0067\U0001F3F4", options: twoClusterOptions},
    {name: "emoji tag sequence before base", description: england + "a", options: twoClusterOptions},

    {name: "decomposed combining mark", description: "e\u0301", options: twoClusterOptions, wantFinding: true},
    {name: "spacing mark", description: "\u0915\u093E", options: twoClusterOptions, wantFinding: true},
    {name: "hangul jamo syllable", description: "\u1100\u1161\u11A8", options: twoClusterOptions, wantFinding: true},
    {name: "emoji zwj family", description: family, options: twoClusterOptions, wantFinding: true},
    {name: "emoji modifier", description: "\U0001F44D\U0001F3FD", options: twoClusterOptions, wantFinding: true},
    {name: "regional indicator pair", description: "\U0001F1EC\U0001F1E7", options: twoClusterOptions, wantFinding: true},
    {name: "three regional indicators", description: "\U0001F1EC\U0001F1E7\U0001F1FA", options: twoClusterOptions},

    {name: "default rejects two prepend clusters", description: "\u0600a\u0600b", wantFinding: true},
    {name: "default accepts three prepend clusters", description: "\u0600a\u0600b\u0600c"},
  }

  for _, testCase := range testCases {
    t.Run(testCase.name, func(t *testing.T) {
      source := fmt.Sprintf(
        "// @ts-expect-error %s\nconst value: number = 1;\nJSON.stringify(value);\n",
        testCase.description,
      )
      _, _, findings := runRuleFindingsSnapshot(t, ruleName, source, testCase.options)
      if testCase.wantFinding {
        if len(findings) != 1 {
          t.Fatalf("want one short-description finding, got %d (%+v)", len(findings), findings)
        }
        return
      }
      if len(findings) != 0 {
        t.Fatalf("want no finding, got %d (%+v)", len(findings), findings)
      }
    })
  }
}
