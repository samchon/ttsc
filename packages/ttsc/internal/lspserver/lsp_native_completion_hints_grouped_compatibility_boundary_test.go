package lspserver

import (
  "reflect"
  "testing"
)

// TestNativeCompletionHintsKeepGroupedWireAndRejectInvalidEntries verifies the
// compatibility and validation boundary.
//
// Third-party sidecars may already publish the grouped shape documented by the
// first proxy implementation. Those responses remain valid, while empty items,
// empty triggers, and structurally malformed JSON must not enter the corpus.
//
//  1. Decode a grouped response containing valid and empty entries.
//  2. Assert the valid group's item order survives and empty entries are dropped.
//  3. Assert a field with the wrong JSON type rejects the response.
//
// @evidence contracts/testing.md#behavioral-verification A grouped hint response keeps valid groups in item order, drops empty items and empty triggers, and a field of the wrong JSON type rejects the response.
// @evidence contracts/testing.md#independent-expectations The expected corpus and the rejection are literal.
// @evidence contracts/testing.md#distinguishing-cases Valid, empty and malformed entries are separate inputs.
// @evidence contracts/testing.md#execution-ownership TestNativeCompletionHintsKeepGroupedWireAndRejectInvalidEntries is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestNativeCompletionHintsKeepGroupedWireAndRejectInvalidEntries(t *testing.T) {
  body := []byte(`[
    {
      "scope":"jsdoc",
      "after":"@legacy ",
      "items":[
        {"insert":"legacy-first","detail":"kept"},
        {"insert":""},
        {"insert":"legacy-second"}
      ]
    },
    {"scope":"","after":"@missing-scope ","items":[{"insert":"drop"}]},
    {"scope":"jsdoc","after":"","items":[{"insert":"drop"}]},
    {"scope":"jsdoc","after":"@empty ","items":[]},
    {"insert":"","trigger":{"scope":"jsdoc","after":"@flat-empty "}},
    {"insert":"drop","trigger":{"scope":"","after":"@flat-empty-scope "}},
    {"insert":"drop","trigger":{"scope":"jsdoc","after":""}},
    {}
  ]`)

  got, err := decodeNativeCompletionHints(body)
  if err != nil {
    t.Fatalf("decode grouped completion hints: %v", err)
  }
  want := []LSPCompletionHint{{
    Scope: "jsdoc",
    After: "@legacy ",
    Items: []LSPCompletionItem{
      {Insert: "legacy-first", Detail: "kept"},
      {Insert: "legacy-second"},
    },
  }}
  if !reflect.DeepEqual(got, want) {
    t.Errorf("grouped compatibility result:\n got %#v\nwant %#v", got, want)
  }

  malformed := []byte(`[
    {"insert":42,"trigger":{"scope":"jsdoc","after":"@broken "}}
  ]`)
  if _, err := decodeNativeCompletionHints(malformed); err == nil {
    t.Error("wrongly typed flat hint was accepted")
  }
}
