package linthost

import "testing"

// TestNodeSuggestionsPreserveOwnedEditChannels verifies node suggestions and
// automatic fixes retain distinct copied edit storage after caller mutation.
//
// The combined report must copy both the outer choice list and every retained
// edit list. Omitting an unusable action must preserve its diagnostic without
// silently converting any suggestion to an automatic fix.
//
// 1. Report a single action and a combined fix with ordered valid/empty choices.
// 2. Mutate retained caller inputs and require the original collected payloads.
// 3. Report empty actions and guarded inputs; require diagnostics only for the
//    former and no additional collection for off severity or nil nodes.
//
// @evidence contracts/testing.md#behavioral-verification Real Context node reporting preserves literal [2,4) source bounds, diagnostic identity and copied edits while separating automatic fixes from ordered opt-in choices; empty actions retain diagnostics and guarded calls collect nothing.
// @evidence contracts/testing.md#independent-expectations Authored source two spaces followed by x semicolon independently locates the token at byte 2 and statement end at byte 4. Literal titles, ranges, replacements and four reports define the expected payloads without calling cloning helpers for the oracle.
// @evidence contracts/testing.md#distinguishing-cases Single and combined reporting, two valid choices separated by empty-title/empty-edit choices, mutations of outer and nested slices, omitted actions, nil nodes and off severity distinguish channel isolation, stable ordering and real reporting from inert callbacks.
// @evidence contracts/testing.md#execution-ownership A genuine parsed virtual source and observing collector invoke both owning Context methods directly in-process. No filesystem producer, LSP command, public adapter, install or rewrite runs; this case checks the internal ownership boundary only.
func TestNodeSuggestionsPreserveOwnedEditChannels(t *testing.T) {
  file := parseTS(t, "  x;\n")
  node := file.Statements.Nodes[0]
  var findings []*Finding
  ctx := &Context{
    File:     file,
    Severity: SeverityError,
    rule:     reportRangeSuggestionTestRule{},
    collect: func(finding *Finding) { findings = append(findings, finding) },
  }
  single := []TextEdit{{Pos: 2, End: 3, Text: "single"}}
  ctx.ReportSuggestion(node, "single message", "single title", single...)
  single[0] = TextEdit{Pos: 0, End: 1, Text: "mutated"}

  fix := []TextEdit{{Pos: 2, End: 3, Text: "automatic"}}
  first := []TextEdit{{Pos: 2, End: 3, Text: "first"}}
  last := []TextEdit{{Pos: 2, End: 3, Text: "last"}}
  choices := []Suggestion{
    {Title: "first title", Edits: first},
    {Title: "", Edits: []TextEdit{{Pos: 2, End: 3, Text: "omitted"}}},
    {Title: "empty edits"},
    {Title: "last title", Edits: last},
  }
  ctx.ReportFixSuggestions(node, "combined message", fix, choices...)
  fix[0].Text, first[0].Text, last[0].Text = "mutated fix", "mutated first", "mutated last"
  choices[0] = Suggestion{Title: "mutated choice"}
  ctx.ReportSuggestion(node, "empty title", "", TextEdit{Pos: 2, End: 3, Text: "ignored"})
  ctx.ReportSuggestion(node, "empty edits", "unused title")
  ctx.ReportSuggestion(nil, "nil single", "title", single...)
  ctx.ReportFixSuggestions(nil, "nil combined", fix, choices...)
  ctx.Severity = SeverityOff
  ctx.ReportSuggestion(node, "off single", "title", single...)
  ctx.ReportFixSuggestions(node, "off combined", fix, choices...)

  if len(findings) != 4 {
    t.Fatalf("findings = %d, want 4", len(findings))
  }
  messages := []string{"single message", "combined message", "empty title", "empty edits"}
  for i, finding := range findings {
    if finding.File != file || finding.Rule != "test/range-suggestion" || finding.Severity != SeverityError || finding.Message != messages[i] || finding.Pos != 2 || finding.End != 4 {
      t.Fatalf("finding %d lost its diagnostic: %+v", i, finding)
    }
  }
  one := findings[0]
  if len(one.Fix) != 0 || len(one.Suggestions) != 1 || one.Suggestions[0].Title != "single title" || len(one.Suggestions[0].Edits) != 1 || one.Suggestions[0].Edits[0] != (TextEdit{Pos: 2, End: 3, Text: "single"}) {
    t.Fatalf("single suggestion changed or entered fix channel: %+v", one)
  }
  combined := findings[1]
  if len(combined.Fix) != 1 || combined.Fix[0] != (TextEdit{Pos: 2, End: 3, Text: "automatic"}) || len(combined.Suggestions) != 2 {
    t.Fatalf("combined channels changed: %+v", combined)
  }
  for i, expected := range []Suggestion{
    {Title: "first title", Edits: []TextEdit{{Pos: 2, End: 3, Text: "first"}}},
    {Title: "last title", Edits: []TextEdit{{Pos: 2, End: 3, Text: "last"}}},
  } {
    got := combined.Suggestions[i]
    if got.Title != expected.Title || len(got.Edits) != 1 || got.Edits[0] != expected.Edits[0] {
      t.Fatalf("choice %d changed: %+v", i, got)
    }
  }
  for _, finding := range findings[2:] {
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("empty action advertised edits: %+v", finding)
    }
  }
}