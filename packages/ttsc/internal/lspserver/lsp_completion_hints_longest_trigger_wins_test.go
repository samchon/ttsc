package lspserver

import "testing"

// TestLSPCompletionHintsLongestTriggerWins pins the rule that makes a hint
// corpus layerable.
//
// A plugin publishes broad and narrow triggers at once — `@`, `@evidence `,
// `@evidence docs/spec.md#` — because it cannot ask a question per keystroke and
// so must describe every position up front. Only the longest match may answer.
// Without that, typing `@evidence docs/spec.md#pri` would offer tag names,
// document paths, and anchors together, and the narrow corpus the user actually
// wants would be buried under the broad one that also matches.
//
//  1. Publish three nested triggers.
//  2. Ask at a cursor inside the narrowest.
//  3. Assert only the narrowest answers, and that the filter is the text after
//     it rather than the whole line.
func TestLSPCompletionHintsLongestTriggerWins(t *testing.T) {
  hints := []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "evidence"}}},
    {Scope: "jsdoc", After: "@evidence ", Items: []LSPCompletionItem{{Insert: "docs/spec.md"}}},
    {Scope: "jsdoc", After: "@evidence docs/spec.md#", Items: []LSPCompletionItem{
      {Insert: "pricing"},
      {Insert: "refunds"},
    }},
  }

  cases := []struct {
    line   string
    want   []string
    filter string
  }{
    {" * @evi", []string{"evidence"}, "evi"},
    {" * @evidence docs/sp", []string{"docs/spec.md"}, "docs/sp"},
    {" * @evidence docs/spec.md#pri", []string{"pricing", "refunds"}, "pri"},
    // The boundary that makes the filter meaningful: at the trigger's own edge
    // the filter is empty and everything is offered.
    {" * @evidence docs/spec.md#", []string{"pricing", "refunds"}, ""},
  }
  for _, entry := range cases {
    items, filter := matchCompletionHints(hints, entry.line, true)
    got := inserts(items)
    if !equalStrings(got, entry.want) {
      t.Errorf("line %q offered %v, want %v", entry.line, got, entry.want)
    }
    if filter != entry.filter {
      t.Errorf("line %q filtered on %q, want %q", entry.line, filter, entry.filter)
    }
  }
}

// TestLSPCompletionHintsRefuseOutsideScope pins the negative twin.
//
// A line prefix alone cannot tell `@evidence` in a doc comment from
// `@Injectable` above a class — both end in `@`. Scope is what separates them,
// and a corpus that ignored it would fire in every decorator position. An
// unknown scope is refused for the same reason: a hint from a newer plugin than
// this host must contribute nothing rather than fire everywhere.
//
//  1. Ask the same line outside a JSDoc block.
//  2. Ask with a scope this host does not know.
//  3. Assert silence in both.
func TestLSPCompletionHintsRefuseOutsideScope(t *testing.T) {
  hints := []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "evidence"}}},
  }
  if items, _ := matchCompletionHints(hints, "@Inj", false); len(items) != 0 {
    t.Errorf("a decorator position was offered %v, want nothing", inserts(items))
  }

  future := []LSPCompletionHint{
    {Scope: "markdown", After: "@", Items: []LSPCompletionItem{{Insert: "nope"}}},
  }
  if items, _ := matchCompletionHints(future, " * @", true); len(items) != 0 {
    t.Errorf("an unknown scope was offered %v, want nothing", inserts(items))
  }

  empty := []LSPCompletionHint{
    {Scope: "jsdoc", After: "", Items: []LSPCompletionItem{{Insert: "nope"}}},
    {Scope: "jsdoc", After: "@", Items: nil},
  }
  if items, _ := matchCompletionHints(empty, " * @", true); len(items) != 0 {
    t.Errorf("a degenerate hint was offered %v, want nothing", inserts(items))
  }
}

// TestCursorInJSDocTracksTheBlock pins the scope test itself.
//
// It is a backward scan rather than a parse, so the cases that matter are the
// ones where a naive "is there a /** before me" would be wrong: after the block
// closed, and inside a line comment that only looks like one.
//
//  1. A cursor inside an open block is in scope.
//  2. A cursor after the block closed is not.
//  3. A line comment is never a doc comment.
func TestCursorInJSDocTracksTheBlock(t *testing.T) {
  cases := []struct {
    text string
    want bool
  }{
    {"/**\n * @evi", true},
    {"/** @evi", true},
    {"/**\n * ok\n */\nconst x = @", false},
    {"// @evi", false},
    {"const x = 1; @", false},
    // A second block after a closed one: the open must win again.
    {"/** a */\n/**\n * @evi", true},
  }
  for _, entry := range cases {
    if got := cursorInJSDoc(entry.text, len(entry.text)); got != entry.want {
      t.Errorf("cursorInJSDoc(%q) = %v, want %v", entry.text, got, entry.want)
    }
  }
}

// TestLinePrefixStopsAtTheLine pins that a trigger is line-local.
//
// A trigger matched against the whole document would let a `@evidence` three
// lines up offer anchors on an unrelated line.
func TestLinePrefixStopsAtTheLine(t *testing.T) {
  text := "/**\n * @evidence docs/spec.md#pri"
  if got, want := linePrefixAt(text, len(text)), " * @evidence docs/spec.md#pri"; got != want {
    t.Errorf("linePrefixAt = %q, want %q", got, want)
  }
  if got := linePrefixAt("no newline", 2); got != "no" {
    t.Errorf("linePrefixAt with no newline = %q, want %q", got, "no")
  }
}

func inserts(items []LSPCompletionItem) []string {
  out := []string{}
  for _, item := range items {
    out = append(out, item.Insert)
  }
  return out
}

func equalStrings(a, b []string) bool {
  if len(a) != len(b) {
    return false
  }
  for i := range a {
    if a[i] != b[i] {
      return false
    }
  }
  return true
}
