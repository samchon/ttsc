package lspserver

import "testing"

// TestLSPCompletionHintsNearestTriggerWins keeps completion tied to the trigger
// nearest the cursor, not merely the longest text somewhere earlier on the
// line. At one occurrence, nested triggers remain layerable and duplicate
// producers of the same trigger may contribute together.
//
// @evidence contracts/testing.md#behavioral-verification Completion follows the trigger nearest the cursor, keeping nested triggers layerable and letting duplicate producers of one trigger contribute together.
// @evidence contracts/testing.md#independent-expectations The expected item lists and filters are literal per line.
// @evidence contracts/testing.md#distinguishing-cases Lines with an earlier long trigger and a later short one, a later broad trigger and duplicate producers separate nearest from longest-earlier.
// @evidence contracts/testing.md#execution-ownership TestLSPCompletionHintsNearestTriggerWins is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestLSPCompletionHintsNearestTriggerWins(t *testing.T) {
  hints := []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "broad"}}},
    {Scope: "jsdoc", After: "@task", Items: []LSPCompletionItem{{Insert: "task"}}},
    {Scope: "jsdoc", After: "@bird", Items: []LSPCompletionItem{{Insert: "bird"}}},
    {Scope: "jsdoc", After: "@fish", Items: []LSPCompletionItem{{Insert: "fish"}}},
    {Scope: "jsdoc", After: "@note", Items: []LSPCompletionItem{{Insert: "first"}}},
    {Scope: "jsdoc", After: "@note", Items: []LSPCompletionItem{{Insert: "second"}}},
  }

  for _, entry := range []struct {
    line   string
    want   []string
    filter string
  }{
    {" * @task details @", []string{"broad"}, ""},
    {" * @task details", []string{"task"}, " details"},
    {" * @bird then @fish tail", []string{"fish"}, " tail"},
    {" * @note draft", []string{"first", "second"}, " draft"},
  } {
    items, filter := matchCompletionHints(hints, entry.line, true)
    if got := inserts(items); !equalStrings(got, entry.want) {
      t.Errorf("line %q offered %v, want %v", entry.line, got, entry.want)
    }
    if filter != entry.filter {
      t.Errorf("line %q filtered on %q, want %q", entry.line, filter, entry.filter)
    }
  }
}
