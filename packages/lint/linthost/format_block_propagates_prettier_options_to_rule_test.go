package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatBlockPropagatesPrettierOptionsToRule verifies the
// translation table from Prettier-flat keys to rule-option JSON.
//
// This case pins the authored nondefault settings at the engine-options
// boundary. If their translation regressed
// silently (mapped `singleQuote: true` to `prefer: "double"`, etc.),
// every downstream rule would see the wrong option blob — far worse
// than a load-time error, because diagnostics would still fire,
// just incorrectly.
//
//  1. Build an ITtscLintConfig object whose `format` block exercises one non-default value per
//     mapping cell: semi, singleQuote, trailingComma, printWidth,
//     tabWidth, useTabs, endOfLine, sortImports.order, jsDoc with
//     tagSynonyms.
//  2. Parse it and inspect the option blob attached to each rule.
//  3. Assert every cell decodes to the expected JSON.
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore emits never semis, single quotes, es5 commas, width100/tab4/tabs/crlf, exact import order, and foo-to-bar JSDoc synonym options.
// @evidence contracts/testing.md#independent-expectations Public format keys have documented meanings that determine literal rule-option values; independent JSON decoding checks each authored nondefault value rather than using the expansion to create expectations.
// @evidence contracts/testing.md#distinguishing-cases Owns all originally authored nondefault mapping cells, including complete import-order sequence; field type errors and explicit opt-outs are separate tests.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. The authored nondefault format object reaches parseExternalConfigStore and independent decoding of each RuleOptions payload in-process; configuration translation is observed without installing Prettier or formatting a consumer.
func TestFormatBlockPropagatesPrettierOptionsToRule(t *testing.T) {
  resolver, err := parseExternalConfigStore(map[string]any{
    "format": map[string]any{
      "semi":          false,
      "singleQuote":   true,
      "trailingComma": "es5",
      "printWidth":    100,
      "tabWidth":      4,
      "useTabs":       true,
      "endOfLine":     "crlf",
      "sortImports":   map[string]any{"order": []any{"<THIRD_PARTY_MODULES>", "^[./]"}},
      "jsDoc": map[string]any{
        "tagSynonyms": map[string]any{"foo": "bar"},
      },
    },
  }, "")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }

  type semiOpts struct {
    Prefer string `json:"prefer"`
  }
  var semi semiOpts
  if err := json.Unmarshal(resolver.RuleOptions("format/semi"), &semi); err != nil {
    t.Fatalf("decode semi: %v", err)
  }
  if semi.Prefer != "never" {
    t.Errorf("semi: false should map to prefer=never, got %q", semi.Prefer)
  }

  type quotesOpts struct {
    Prefer string `json:"prefer"`
  }
  var quotes quotesOpts
  if err := json.Unmarshal(resolver.RuleOptions("format/quotes"), &quotes); err != nil {
    t.Fatalf("decode quotes: %v", err)
  }
  if quotes.Prefer != "single" {
    t.Errorf("singleQuote: true should map to prefer=single, got %q", quotes.Prefer)
  }

  type tcOpts struct {
    Mode string `json:"mode"`
  }
  var tc tcOpts
  if err := json.Unmarshal(resolver.RuleOptions("format/trailing-comma"), &tc); err != nil {
    t.Fatalf("decode trailing-comma: %v", err)
  }
  if tc.Mode != "es5" {
    t.Errorf("trailingComma should map verbatim, got %q", tc.Mode)
  }

  type pwOpts struct {
    PrintWidth int    `json:"printWidth"`
    TabWidth   int    `json:"tabWidth"`
    UseTabs    bool   `json:"useTabs"`
    EndOfLine  string `json:"endOfLine"`
  }
  var pw pwOpts
  if err := json.Unmarshal(resolver.RuleOptions("format/print-width"), &pw); err != nil {
    t.Fatalf("decode print-width: %v", err)
  }
  if pw.PrintWidth != 100 || pw.TabWidth != 4 || !pw.UseTabs || pw.EndOfLine != "crlf" {
    t.Errorf("print-width options mismatch: %+v", pw)
  }

  type siOpts struct {
    Order []string `json:"order"`
  }
  var si siOpts
  if err := json.Unmarshal(resolver.RuleOptions("format/sort-imports"), &si); err != nil {
    t.Fatalf("decode sort-imports: %v", err)
  }
  if len(si.Order) != 2 || si.Order[0] != "<THIRD_PARTY_MODULES>" || si.Order[1] != "^[./]" {
    t.Errorf("sort-imports order mismatch: %+v", si.Order)
  }

  type jdOpts struct {
    TagSynonyms map[string]string `json:"tagSynonyms"`
  }
  var jd jdOpts
  if err := json.Unmarshal(resolver.RuleOptions("format/jsdoc"), &jd); err != nil {
    t.Fatalf("decode jsdoc: %v", err)
  }
  if jd.TagSynonyms["foo"] != "bar" {
    t.Errorf("jsdoc tagSynonyms mismatch: %+v", jd.TagSynonyms)
  }
}
