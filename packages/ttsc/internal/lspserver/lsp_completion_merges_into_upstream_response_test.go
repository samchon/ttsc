package lspserver

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestLSPCompletionMergesIntoUpstreamResponse pins the response merge.
//
// tsgo answers completion in three shapes — a bare item array, a CompletionList,
// or null — and picks per request. Each has to be handled rather than assumed,
// because guessing wrong does not error: it silently drops either the plugin's
// items or the compiler's, and the user simply sees a shorter list than they
// should. That is the failure this whole channel is most likely to ship with.
//
//  1. Merge into each of the three shapes.
//  2. Assert upstream's items survive alongside the plugin's in every one.
//  3. Assert isIncomplete stays upstream's answer, not ours.
func TestLSPCompletionMergesIntoUpstreamResponse(t *testing.T) {
  items := []LSPCompletionItem{{Insert: "pricing", Detail: "Pricing"}}

  cases := []struct {
    name       string
    body       string
    wantLabels []string
    incomplete bool
  }{
    {
      name:       "bare array",
      body:       `{"jsonrpc":"2.0","id":1,"result":[{"label":"toString"}]}`,
      wantLabels: []string{"toString", "pricing"},
    },
    {
      name:       "completion list preserves isIncomplete",
      body:       `{"jsonrpc":"2.0","id":1,"result":{"isIncomplete":true,"items":[{"label":"toString"}]}}`,
      wantLabels: []string{"toString", "pricing"},
      incomplete: true,
    },
    {
      // Not an edge case: tsgo returns null for completion in JSDoc prose,
      // which is exactly where these hints live. This is the common shape.
      name:       "null result",
      body:       `{"jsonrpc":"2.0","id":1,"result":null}`,
      wantLabels: []string{"pricing"},
    },
  }
  for _, entry := range cases {
    merged := mergeCompletionResponse([]byte(entry.body), items)
    var decoded struct {
      Result struct {
        IsIncomplete bool `json:"isIncomplete"`
        Items        []struct {
          Label      string `json:"label"`
          InsertText string `json:"insertText"`
          Detail     string `json:"detail"`
        } `json:"items"`
      } `json:"result"`
    }
    if err := json.Unmarshal(merged, &decoded); err != nil {
      t.Fatalf("%s: merged body is not valid JSON: %v\n%s", entry.name, err, merged)
    }
    labels := []string{}
    for _, item := range decoded.Result.Items {
      labels = append(labels, item.Label)
    }
    if !equalStrings(labels, entry.wantLabels) {
      t.Errorf("%s: merged labels %v, want %v", entry.name, labels, entry.wantLabels)
    }
    if decoded.Result.IsIncomplete != entry.incomplete {
      t.Errorf(
        "%s: isIncomplete = %v, want %v — the flag is upstream's to own",
        entry.name, decoded.Result.IsIncomplete, entry.incomplete,
      )
    }
  }

  // A hint with no Label falls back to Insert, because the editor lists Label
  // and an empty one renders as a blank row.
  merged := mergeCompletionResponse([]byte(`{"jsonrpc":"2.0","id":1,"result":null}`), items)
  if !strings.Contains(string(merged), `"label":"pricing"`) {
    t.Errorf("an item without a Label must fall back to Insert:\n%s", merged)
  }
  if !strings.Contains(string(merged), `"insertText":"pricing"`) {
    t.Errorf("insertText must carry Insert:\n%s", merged)
  }
}

// TestLSPCompletionLeavesUpstreamErrorsAlone pins the negative twin.
//
// An upstream error is upstream's to report. Appending completions to it would
// turn a failure into a half-answer that looks like it worked, which is worse
// than the error the user was supposed to see.
func TestLSPCompletionLeavesUpstreamErrorsAlone(t *testing.T) {
  body := `{"jsonrpc":"2.0","id":1,"error":{"code":-32603,"message":"boom"}}`
  if got := string(mergeCompletionResponse([]byte(body), []LSPCompletionItem{{Insert: "x"}})); got != body {
    t.Errorf("an upstream error was rewritten:\n%s", got)
  }

  // Nothing to add is not a reason to rewrite a body either.
  plain := `{"jsonrpc":"2.0","id":1,"result":[]}`
  if got := string(mergeCompletionResponse([]byte(plain), nil)); got != plain {
    t.Errorf("an empty contribution rewrote the body:\n%s", got)
  }
}

// TestOffsetForPositionCountsUTF16 pins the position conversion.
//
// LSP counts a position's character in UTF-16 code units, not bytes. A line
// holding an emoji or CJK text would otherwise land the cursor mid-token, and
// the line prefix — which every trigger matches against — would be cut in the
// wrong place. The failure is silent: completion just stops appearing on lines
// with non-ASCII text.
//
//  1. Convert an ASCII position.
//  2. Convert past CJK text, which is one UTF-16 unit but three bytes.
//  3. Convert past an emoji, which is a surrogate pair — two units, four bytes.
func TestOffsetForPositionCountsUTF16(t *testing.T) {
  cases := []struct {
    text      string
    line      int
    character int
    want      string
  }{
    {"abc", 0, 2, "ab"},
    {"/**\n * @evi", 1, 7, "/**\n * @evi"},
    // 가격 is two runes, two UTF-16 units, six bytes.
    {"// 가격 x", 0, 5, "// 가격"},
    // An emoji past the BMP costs two units.
    {"// 🚀 x", 0, 5, "// 🚀"},
  }
  for _, entry := range cases {
    offset, ok := offsetForPosition(entry.text, entry.line, entry.character)
    if !ok {
      t.Errorf("offsetForPosition(%q, %d, %d) failed", entry.text, entry.line, entry.character)
      continue
    }
    if got := entry.text[:offset]; got != entry.want {
      t.Errorf(
        "offsetForPosition(%q, %d, %d) cut at %q, want %q",
        entry.text, entry.line, entry.character, got, entry.want,
      )
    }
  }

  if _, ok := offsetForPosition("one line", 5, 0); ok {
    t.Error("a line past the end must fail rather than clamp silently")
  }
}
