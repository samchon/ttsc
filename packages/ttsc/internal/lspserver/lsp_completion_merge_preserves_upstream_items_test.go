package lspserver

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestLSPCompletionMergePreservesUpstreamItems pins the response merge across
// all three shapes LSP allows.
//
// tsgo answers completion as a bare item array, a CompletionList, or null, and
// picks per request. Guessing wrong does not error — it silently drops either
// the compiler's suggestions or the plugin's, and a user would only notice as
// "completion got worse sometimes". Each shape is therefore pinned, and each
// asserts BOTH sides survive.
//
//  1. Merge into an array response, a CompletionList, and a null.
//  2. Assert upstream's items are still present and ours are appended.
//  3. Assert isIncomplete is upstream's to own.
func TestLSPCompletionMergePreservesUpstreamItems(t *testing.T) {
  ours := []LSPCompletionItem{{Insert: "pricing", Detail: "Pricing"}}

  // Shape 1: a bare array.
  merged := mergeCompletionResponse(
    []byte(`{"jsonrpc":"2.0","id":1,"result":[{"label":"tsgoItem"}]}`),
    ours,
  )
  assertHasLabels(t, merged, "tsgoItem", "pricing")

  // Shape 2: a CompletionList, whose isIncomplete must survive untouched.
  // It is upstream's claim about upstream's items; ours are complete by
  // construction and cannot make an incomplete list complete.
  merged = mergeCompletionResponse(
    []byte(`{"jsonrpc":"2.0","id":2,"result":{"isIncomplete":true,"items":[{"label":"tsgoItem"}]}}`),
    ours,
  )
  assertHasLabels(t, merged, "tsgoItem", "pricing")
  if !strings.Contains(string(merged), `"isIncomplete":true`) {
    t.Errorf("isIncomplete was not preserved: %s", merged)
  }

  // Shape 3: null — tsgo returns this in JSDoc prose, which is exactly where
  // our hints live, so this is the common case and not an edge one.
  merged = mergeCompletionResponse(
    []byte(`{"jsonrpc":"2.0","id":3,"result":null}`),
    ours,
  )
  assertHasLabels(t, merged, "pricing")
}

// TestLSPCompletionMergeLeavesUpstreamErrorsAlone pins the negative twin.
//
// Appending completions to an error response would turn a failure into a
// half-answer, and the editor would render suggestions for a request the server
// says it could not serve.
func TestLSPCompletionMergeLeavesUpstreamErrorsAlone(t *testing.T) {
  body := []byte(`{"jsonrpc":"2.0","id":4,"error":{"code":-32603,"message":"boom"}}`)
  if got := mergeCompletionResponse(body, []LSPCompletionItem{{Insert: "x"}}); string(got) != string(body) {
    t.Errorf("an error response was rewritten:\n got: %s\nwant: %s", got, body)
  }

  // No items is not a merge. The body must come back byte-identical rather
  // than round-tripped through a marshal that could reorder or reshape it.
  plain := []byte(`{"jsonrpc":"2.0","id":5,"result":[{"label":"only"}]}`)
  if got := mergeCompletionResponse(plain, nil); string(got) != string(plain) {
    t.Errorf("an unmerged body was rewritten:\n got: %s\nwant: %s", got, plain)
  }
}

// TestOffsetForPositionCountsUTF16 pins the position conversion.
//
// LSP counts characters in UTF-16 code units, not bytes and not runes. A line
// holding an emoji costs two units for one rune; counting bytes would put the
// cursor several characters early and match the wrong trigger, and counting
// runes would be off by one per astral character. Neither fails loudly.
func TestOffsetForPositionCountsUTF16(t *testing.T) {
  // "🙂" is one rune, two UTF-16 units, four bytes.
  text := "/**\n * 🙂 @evi"
  offset, ok := offsetForPosition(text, 1, 10)
  if !ok {
    t.Fatal("position did not resolve")
  }
  if got, want := text[:offset], "/**\n * 🙂 @evi"; got != want {
    t.Errorf("offset landed at %q, want %q", got, want)
  }

  // A character past the line's end clamps to the line rather than running on
  // into the next one.
  offset, ok = offsetForPosition("ab\ncd", 0, 99)
  if !ok || offset != 2 {
    t.Errorf("past-end position resolved to %d, want 2", offset)
  }

  // A line past the document's end does not resolve.
  if _, ok := offsetForPosition("ab", 5, 0); ok {
    t.Error("a line past the end resolved, want failure")
  }
}

func assertHasLabels(t *testing.T, body []byte, labels ...string) {
  t.Helper()
  var envelope struct {
    Result struct {
      Items []struct {
        Label string `json:"label"`
      } `json:"items"`
    } `json:"result"`
  }
  if err := json.Unmarshal(body, &envelope); err != nil {
    t.Fatalf("merged body is not a CompletionList: %v\n%s", err, body)
  }
  for _, want := range labels {
    found := false
    for _, item := range envelope.Result.Items {
      if item.Label == want {
        found = true
      }
    }
    if !found {
      t.Errorf("label %q missing from merged response: %s", want, body)
    }
  }
}
