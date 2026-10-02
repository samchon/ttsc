package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatBlockPropagatesJsdocSortTagsOption verifies that sortTags: true
// inside a format.jsDoc object is accepted and forwarded to the format/jsdoc
// rule entry.
//
// Locks the success arm at `jdOpts["sortTags"] = b` inside expandFormatBlock.
// The existing invalid-jsdoc-options test proves the validation rejects non-bool
// values; this test proves that a valid bool value IS forwarded rather than
// silently dropped.
//
//  1. Build a format block with jsDoc: {sortTags: true}.
//  2. Call expandFormatBlock.
//  3. Assert no error.
//  4. Assert the format/jsdoc options contain sortTags: true.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock emits a format/jsdoc options tuple with sortTags true from an authored jsDoc object.
// @evidence contracts/testing.md#independent-expectations A valid public sortTags Boolean must reach the rule payload unchanged; independently decoding the emitted tuple compares it with the literal true request.
// @evidence contracts/testing.md#distinguishing-cases Owns enabled object customization; invalid sortTags type and Boolean false opt-out execute separately.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored sortTags true object reaches expandFormatBlock and independent JSON tuple decoding in-process; emitted Boolean is observed without running JSDoc formatting or a child evaluator.
func TestFormatBlockPropagatesJsdocSortTagsOption(t *testing.T) {
  out, err := expandFormatBlock(map[string]any{
    "jsDoc": map[string]any{
      "sortTags": true,
    },
  })
  if err != nil {
    t.Fatalf("expandFormatBlock: unexpected error: %v", err)
  }

  entry, ok := out["format/jsdoc"]
  if !ok {
    t.Fatal("formatJsdoc not present in output")
  }
  raw, err := json.Marshal(entry)
  if err != nil {
    t.Fatalf("marshal entry: %v", err)
  }

  // The entry is []any{"off", {options}}.
  var tuple []json.RawMessage
  if err := json.Unmarshal(raw, &tuple); err != nil || len(tuple) < 2 {
    t.Fatalf("entry not a [severity, opts] tuple: %v", err)
  }
  var opts struct {
    SortTags bool `json:"sortTags"`
  }
  if err := json.Unmarshal(tuple[1], &opts); err != nil {
    t.Fatalf("decode jsdoc opts: %v", err)
  }
  if !opts.SortTags {
    t.Error("sortTags should be true")
  }
}
