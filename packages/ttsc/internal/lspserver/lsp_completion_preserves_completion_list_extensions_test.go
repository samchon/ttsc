package lspserver

import (
  "encoding/json"
  "reflect"
  "testing"
)

// TestLSPCompletionPreservesCompletionListExtensions verifies lossless merging.
//
// TypeScript-Go uses CompletionList.itemDefaults, and newer protocol versions
// may add more list-level fields. Decoding into a closed local struct silently
// removed those fields whenever a plugin contributed even one completion.
//
//  1. Build an upstream CompletionList with itemDefaults, applyKind, and a future field.
//  2. Merge one plugin completion.
//  3. Assert itemDefaults, the future field, and isIncomplete survive verbatim,
//     the upstream item receives the defaults it relied on, and applyKind is
//     rewritten to replace (1) because those defaults are now materialized into
//     each item and must not merge a second time.
//
// @evidence contracts/testing.md#behavioral-verification Merging one plugin completion keeps itemDefaults, a future list-level field and isIncomplete verbatim, gives the upstream item the defaults it relied on and rewrites applyKind to replace (1).
// @evidence contracts/testing.md#independent-expectations The expected JSON members are literals written from the upstream CompletionList body.
// @evidence contracts/testing.md#distinguishing-cases A closed local struct would drop the future field; the defaults-materialization and applyKind rewrite are separate assertions.
// @evidence contracts/testing.md#execution-ownership TestLSPCompletionPreservesCompletionListExtensions is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestLSPCompletionPreservesCompletionListExtensions(t *testing.T) {
  body := []byte(`{
    "jsonrpc":"2.0",
    "id":1,
    "result":{
      "isIncomplete":true,
      "itemDefaults":{"commitCharacters":["."],"insertTextFormat":2,"data":{"session":"upstream","shared":"default"}},
      "applyKind":{"commitCharacters":2,"data":2},
      "x-future":{"nested":[1,2,3]},
      "items":[{
        "label":"upstream",
        "labelDetails":{"detail":" kept"},
        "commitCharacters":["("],
        "data":{"shared":"item","token":42}
      }]
    }
  }`)
  merged := mergeCompletionResponse(body, []LSPCompletionItem{{Insert: "plugin"}})
  var response struct {
    Result map[string]json.RawMessage `json:"result"`
  }
  if err := json.Unmarshal(merged, &response); err != nil {
    t.Fatalf("decode merged completion response: %v\n%s", err, merged)
  }

  assertJSON := func(field string, want string) {
    t.Helper()
    raw, exists := response.Result[field]
    if !exists {
      t.Errorf("CompletionList field %q was dropped", field)
      return
    }
    var gotValue any
    var wantValue any
    if err := json.Unmarshal(raw, &gotValue); err != nil {
      t.Errorf("decode field %q: %v", field, err)
      return
    }
    if err := json.Unmarshal([]byte(want), &wantValue); err != nil {
      t.Fatalf("decode expected field %q: %v", field, err)
    }
    if !reflect.DeepEqual(gotValue, wantValue) {
      t.Errorf("CompletionList field %q = %s, want %s", field, raw, want)
    }
  }
  assertJSON("itemDefaults", `{"commitCharacters":["."],"insertTextFormat":2,"data":{"session":"upstream","shared":"default"}}`)
  assertJSON("applyKind", `{"commitCharacters":1,"data":1}`)
  assertJSON("x-future", `{"nested":[1,2,3]}`)

  var items []map[string]json.RawMessage
  if err := json.Unmarshal(response.Result["items"], &items); err != nil {
    t.Fatalf("decode merged items: %v", err)
  }
  if len(items) != 2 {
    t.Fatalf("merged %d completion items, want upstream plus plugin", len(items))
  }
  assertItemJSON := func(index int, field string, want string) {
    t.Helper()
    raw, exists := items[index][field]
    if !exists {
      t.Errorf("item %d field %q was dropped", index, field)
      return
    }
    var gotValue any
    var wantValue any
    if err := json.Unmarshal(raw, &gotValue); err != nil {
      t.Errorf("decode item %d field %q: %v", index, field, err)
      return
    }
    if err := json.Unmarshal([]byte(want), &wantValue); err != nil {
      t.Fatalf("decode expected item %d field %q: %v", index, field, err)
    }
    if !reflect.DeepEqual(gotValue, wantValue) {
      t.Errorf("item %d field %q = %s, want %s", index, field, raw, want)
    }
  }
  assertItemJSON(0, "commitCharacters", `["(","."]`)
  assertItemJSON(0, "data", `{"session":"upstream","shared":"item","token":42}`)
  assertItemJSON(1, "commitCharacters", `[]`)
  assertItemJSON(1, "data", `{"$ttsc":"ttsc/completion-hint/v1"}`)
  assertJSON("isIncomplete", "true")
}
