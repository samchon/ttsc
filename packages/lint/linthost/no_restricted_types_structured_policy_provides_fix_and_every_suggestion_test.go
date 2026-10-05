package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedTypesStructuredPolicyProvidesFixAndEverySuggestion verifies a
// structured policy yields its automatic fix and every suggestion.
//
// The message, fix and suggestions fields are independently optional.
//
//  1. Configure custom, empty, fix-only and suggestion-only policies.
//  2. Collect the findings and apply the fix and each suggestion separately.
//  3. Assert the exact edits, titles, rewritten outputs, valid parses and clean
//     fixed points.
//
// @evidence contracts/testing.md#behavioral-verification Structured policies must preserve automatic fixes and every independent suggestion.
// @evidence contracts/testing.md#independent-expectations Authored ranges, replacement strings and titles determine exact edits and complete rewritten outputs, parsing and clean fixed points.
// @evidence contracts/testing.md#distinguishing-cases Custom, empty, fix-only and suggestion-only policies distinguish optional fields; alternatives are applied independently.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedTypesStructuredPolicyProvidesFixAndEverySuggestion invokes the registered rule over an in-process parsed source through runRuleFindingsSnapshot; no native plugin build, compiler child or installation is involved.
func TestNoRestrictedTypesStructuredPolicyProvidesFixAndEverySuggestion(t *testing.T) {
  source := "type Value = /*target*/Legacy;\n"
  options := json.RawMessage(`{
    "types": {
      "Legacy": {
        "message": "Use an explicit safe type.",
        "fixWith": "Modern",
        "suggest": ["Safer", "Safest"]
      }
    }
  }`)
  findings := runNoRestrictedTypes(t, source, options)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1: %+v", len(findings), findings)
  }
  finding := findings[0]
  if finding.Rule != noRestrictedTypesRuleName || finding.Severity != SeverityError {
    t.Fatalf("restriction identity = %+v", finding)
  }
  span := noRestrictedTypesMarkedSpan(t, source, "/*target*/", "Legacy")
  if finding.Pos != span[0] || finding.End != span[1] ||
    finding.Message != "Don't use `Legacy` as a type. Use an explicit safe type." {
    t.Fatalf("finding = %+v, want span %v", finding, span)
  }
  if len(finding.Fix) != 1 || finding.Fix[0] != (TextEdit{Pos: span[0], End: span[1], Text: "Modern"}) {
    t.Fatalf("automatic fix = %+v", finding.Fix)
  }
  if len(finding.Suggestions) != 2 {
    t.Fatalf("suggestions = %+v, want 2", finding.Suggestions)
  }
  replacements := []string{"Safer", "Safest"}
  for index, replacement := range replacements {
    suggestion := finding.Suggestions[index]
    wantTitle := "Replace `Legacy` with `" + replacement + "`."
    if suggestion.Title != wantTitle || len(suggestion.Edits) != 1 ||
      suggestion.Edits[0] != (TextEdit{Pos: span[0], End: span[1], Text: replacement}) {
      t.Fatalf("suggestion %d = %+v, want %q -> %q", index, suggestion, wantTitle, replacement)
    }
    rewritten, applied := applyFindingFixesToText(
      source,
      []*Finding{{Fix: suggestion.Edits}},
    )
    noRestrictedTypesAssertStableRewrite(
      t,
      rewritten,
      "type Value = /*target*/"+replacement+";\n",
      options,
    )
    if applied != 1 {
      t.Fatalf("suggestion %d applied %d edits, want 1", index, applied)
    }
  }

  rewritten, applied := applyFindingFixesToText(source, findings)
  if applied != 1 {
    t.Fatalf("automatic fix applied %d edits, want 1", applied)
  }
  noRestrictedTypesAssertStableRewrite(
    t,
    rewritten,
    "type Value = /*target*/Modern;\n",
    options,
  )

  optionalFields := []struct {
    name        string
    typeName    string
    policy      string
    fixWith     string
    suggestions []string
  }{
    {
      name:     "empty object uses the default message",
      typeName: "EmptyPolicy",
      policy:   `{}`,
    },
    {
      name:     "fix without message",
      typeName: "FixOnly",
      policy:   `{"fixWith":"Modern"}`,
      fixWith:  "Modern",
    },
    {
      name:        "suggestions without message",
      typeName:    "SuggestOnly",
      policy:      `{"suggest":["Safer","Safest"]}`,
      suggestions: []string{"Safer", "Safest"},
    },
  }
  for _, test := range optionalFields {
    t.Run(test.name, func(t *testing.T) {
      source := "type Value = " + test.typeName + ";\n"
      options := json.RawMessage(
        `{"types":{"` + test.typeName + `":` + test.policy + `}}`,
      )
      findings := runNoRestrictedTypes(t, source, options)
      if len(findings) != 1 {
        t.Fatalf("findings = %d, want 1: %+v", len(findings), findings)
      }
      finding := findings[0]
      start := len("type Value = ")
      if finding.Pos != start || finding.End != start+len(test.typeName) {
        t.Fatalf("optional policy range = %+v, want %d..%d", finding, start, start+len(test.typeName))
      }
      if finding.Rule != noRestrictedTypesRuleName || finding.Severity != SeverityError {
        t.Fatalf("restriction identity = %+v", finding)
      }
      if finding.Message != "Don't use `"+test.typeName+"` as a type." {
        t.Fatalf("default message mismatch: %+v", finding)
      }
      if test.fixWith == "" {
        if len(finding.Fix) != 0 {
          t.Fatalf("unexpected automatic fix: %+v", finding.Fix)
        }
      } else {
        rewritten, applied := applyFindingFixesToText(source, findings)
        if applied != 1 {
          t.Fatalf("automatic fix applied %d edits, want 1", applied)
        }
        noRestrictedTypesAssertStableRewrite(
          t,
          rewritten,
          "type Value = "+test.fixWith+";\n",
          options,
        )
      }
      if len(finding.Suggestions) != len(test.suggestions) {
        t.Fatalf("suggestions = %+v, want %v", finding.Suggestions, test.suggestions)
      }
      for index, replacement := range test.suggestions {
        suggestion := finding.Suggestions[index]
        if suggestion.Title != "Replace `"+test.typeName+"` with `"+replacement+"`." {
          t.Fatalf("suggestion %d title = %q", index, suggestion.Title)
        }
        rewritten, applied := applyFindingFixesToText(
          source,
          []*Finding{{Fix: suggestion.Edits}},
        )
        if applied != 1 {
          t.Fatalf("suggestion %d applied %d edits, want 1", index, applied)
        }
        noRestrictedTypesAssertStableRewrite(
          t,
          rewritten,
          "type Value = "+replacement+";\n",
          options,
        )
      }
    })
  }
}
