package lspserver

import "testing"

// TestLSPCompletionHintsLongestTriggerWins pins the rule that makes a hint
// corpus layerable.
//
// A plugin publishes broad and narrow triggers at once — `@`, `@evidence `,
// `@evidence docs/spec.md#` — because it cannot ask a question per keystroke and
// so describes the selected positions up front. These nested matches begin at
// the same occurrence, where the longest wins; different occurrences also have
// a nearest-trigger policy that this fixture does not exercise.
// Without that, typing `@evidence docs/spec.md#pri` would offer tag names,
// document paths, and anchors together, and the narrow corpus the user actually
// wants would be buried under the broad one that also matches.
//
//  1. Publish three nested triggers.
//  2. Ask at a cursor inside the narrowest.
//  3. Assert only the narrowest answers, and that the filter is the text after
//     it rather than the whole line.
//
// @evidence contracts/testing.md#behavioral-verification At a cursor inside the narrowest of three nested triggers only the narrowest hint answers, and its filter is the text after that trigger.
// @evidence contracts/testing.md#independent-expectations The expected items and filter are literals for the published nested triggers.
// @evidence contracts/testing.md#distinguishing-cases Broad, middle and narrow triggers all match the same line, so a matcher that merged them would offer all three.
// @evidence contracts/testing.md#execution-ownership Directly supplies an authored hint corpus and four line prefixes to matchCompletionHints with inJSDoc=true in this process. Literal ordered Insert strings and filters are observed; other item fields, native scope classification, and request publication are not asserted. It substitutes no seam, creates no directory, resolves no sidecar, and starts no Program, process, consumer, or editor connection.
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
//
// @evidence contracts/testing.md#behavioral-verification The same supplied @Inj line and hint yields evidence with inJSDoc=true but no items with false; an authored unknown scope and empty-trigger/nil-item corpus also yield no items. This observes admission booleans, not actual decorator/JSDoc lexical classification or completion publication.
// @evidence contracts/testing.md#independent-expectations The correct-scope control requires the literal evidence Insert; wrong/unknown scope and degenerate hint inputs require empty item lists. Filters and other item fields are not asserted.
// @evidence contracts/testing.md#distinguishing-cases The first positive/negative pair differs only in supplied inJSDoc; unknown-scope and degenerate corpora are separate inputs. The positive control rejects blanket empty output, without authenticating scope parsing.
// @evidence contracts/testing.md#execution-ownership Directly supplies strings, hint records, and inJSDoc booleans to matchCompletionHints in this process. It substitutes no seam, creates no directory, resolves no sidecar, loads no Program, and starts no product process, consumer, or editor connection.
func TestLSPCompletionHintsRefuseOutsideScope(t *testing.T) {
  hints := []LSPCompletionHint{
    {Scope: "jsdoc", After: "@", Items: []LSPCompletionItem{{Insert: "evidence"}}},
  }
  if items, _ := matchCompletionHints(hints, "@Inj", true); !equalStrings(inserts(items), []string{"evidence"}) {
    t.Errorf("correct-scope control offered %v, want evidence", inserts(items))
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
// Six authored end cursors distinguish open and closed JSDoc, a second open
// block, a line comment, and code. The maintained helper scans forward; this
// test observes booleans, not its algorithm, all comment forms, or a request.
//
//  1. A cursor inside an open block is in scope.
//  2. A cursor after the block closed is not.
//  3. The authored line-comment and ordinary-code cursors are not in JSDoc.
//
// @evidence contracts/testing.md#behavioral-verification cursorInJSDoc is true inside an open doc block, including a second block after a closed one, and false after the block closed, in a line comment and in ordinary code.
// @evidence contracts/testing.md#independent-expectations Each source string carries its expected boolean written literally.
// @evidence contracts/testing.md#distinguishing-cases Cases where a naive search for '/**' would be wrong, a closed block and a line comment, sit beside the open blocks.
// @evidence contracts/testing.md#execution-ownership Directly calls cursorInJSDoc on six authored strings and literal booleans in this process. It substitutes no seam, creates no directory, resolves no sidecar, loads no Program, and starts no consumer, child process, or LSP connection.
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
//
// @evidence contracts/testing.md#behavioral-verification linePrefixAt returns only the text of the cursor's own line, and the whole text when it has no newline.
// @evidence contracts/testing.md#independent-expectations The expected prefixes are literal strings.
// @evidence contracts/testing.md#distinguishing-cases A multi-line text and a single line distinguish line-local from document-wide matching.
// @evidence contracts/testing.md#execution-ownership TestLinePrefixStopsAtTheLine is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
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
