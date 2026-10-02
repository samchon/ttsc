package lspserver

import (
  "reflect"
  "testing"
)

// TestNativeCompletionHintsDecodeFlatLintWire verifies the real lint boundary.
//
// @ttsc/lint publishes a flat []rule.Hint rather than the proxy's grouped
// matching shape. Repeated triggers must coalesce without moving the group or
// reordering its items, because slice order is the publisher's ranking channel.
//
//  1. Decode interleaved flat hints using the exact public rule.Hint JSON shape.
//  2. Assert first-trigger group order and per-trigger item order are preserved.
//  3. Feed the decoded corpus to the live matcher and verify it is offerable.
//
// @evidence contracts/testing.md#behavioral-verification Interleaved flat rule hints decode into groups ordered by first trigger with per-trigger item order preserved, and the decoded corpus is offered by the live matcher.
// @evidence contracts/testing.md#independent-expectations The expected group and item order are literals taken from the public rule.Hint JSON shape.
// @evidence contracts/testing.md#distinguishing-cases Repeated triggers must coalesce without reordering, which slice order tests catch.
// @evidence contracts/testing.md#execution-ownership TestNativeCompletionHintsDecodeFlatLintWire is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestNativeCompletionHintsDecodeFlatLintWire(t *testing.T) {
  body := []byte(`[
    {
      "insert":"docs/stable.md",
      "label":"stable",
      "detail":"pinned document",
      "trigger":{"scope":"jsdoc","after":"@evidence "}
    },
    {
      "insert":"param",
      "detail":"JSDoc tag",
      "trigger":{"scope":"jsdoc","after":"@"}
    },
    {
      "insert":"docs/derived.md",
      "label":"derived",
      "trigger":{"scope":"jsdoc","after":"@evidence "}
    }
  ]`)

  got, err := decodeNativeCompletionHints(body)
  if err != nil {
    t.Fatalf("decode flat lint hint wire: %v", err)
  }
  want := []LSPCompletionHint{
    {
      Scope: "jsdoc",
      After: "@evidence ",
      Items: []LSPCompletionItem{
        {Insert: "docs/stable.md", Label: "stable", Detail: "pinned document"},
        {Insert: "docs/derived.md", Label: "derived"},
      },
    },
    {
      Scope: "jsdoc",
      After: "@",
      Items: []LSPCompletionItem{
        {Insert: "param", Detail: "JSDoc tag"},
      },
    },
  }
  if !reflect.DeepEqual(got, want) {
    t.Fatalf("decoded flat hints:\n got %#v\nwant %#v", got, want)
  }

  items, filter := matchCompletionHints(got, " * @evidence docs/", true)
  if filter != "docs/" || !reflect.DeepEqual(items, want[0].Items) {
    t.Errorf("decoded corpus did not reach matcher: filter=%q items=%#v", filter, items)
  }
}
