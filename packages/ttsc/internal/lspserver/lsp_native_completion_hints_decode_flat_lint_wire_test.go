package lspserver

import (
  "reflect"
  "testing"
)

// TestNativeCompletionHintsDecodeFlatLintWire verifies authored flat-wire
// decoding followed by direct matching, without invoking a lint producer.
//
// @ttsc/lint publishes a flat []rule.Hint rather than the proxy's grouped
// matching shape. Repeated triggers must coalesce without moving the group or
// reordering its items, because slice order is the publisher's ranking channel.
//
//  1. Decode interleaved flat hints using the exact public rule.Hint JSON shape.
//  2. Assert first-trigger group order and per-trigger item order are preserved.
//  3. Feed the decoded corpus to the actual matcher for one supplied prefix.
//
// @evidence contracts/testing.md#behavioral-verification Three authored flat hints decode into two complete literal groups, retaining group and per-trigger item order and selected item fields. A direct matcher call with supplied inJSDoc=true requires docs/ filter and the first group's literal items; no real lint publication or lexical cursor classification runs.
// @evidence contracts/testing.md#independent-expectations The expected group and item order are literals taken from the public rule.Hint JSON shape.
// @evidence contracts/testing.md#distinguishing-cases Interleaving one repeated trigger around a distinct trigger distinguishes group/order preservation, including absent optional label/detail fields. One more-specific trigger wins in the supplied prefix; malformed or grouped input and false lexical admission are outside this case.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit directly calls actual decodeNativeCompletionHints and matchCompletionHints on authored JSON and prefix values, using complete literal expectations. It builds or starts no native artifact/producer, installs no consumer and creates no filesystem or product host.
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
