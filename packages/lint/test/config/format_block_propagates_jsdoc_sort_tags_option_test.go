package linthost

import (
  "encoding/json"
  "testing"
)

// TestFormatBlockPropagatesJsdocSortTagsOption verifies that sortTags: true
// inside a format.jsdoc object is accepted and forwarded to the formatJsdoc
// rule entry.
//
// Locks the success arm at `jdOpts["sortTags"] = b` inside expandFormatBlock.
// The existing invalid-jsdoc-options test proves the validation rejects non-bool
// values; this test proves that a valid bool value IS forwarded rather than
// silently dropped.
//
//  1. Build a format block with jsdoc: {sortTags: true}.
//  2. Call expandFormatBlock.
//  3. Assert no error.
//  4. Assert formatJsdoc options contain sortTags: true.
func TestFormatBlockPropagatesJsdocSortTagsOption(t *testing.T) {
  out, err := expandFormatBlock(map[string]any{
    "jsdoc": map[string]any{
      "sortTags": true,
    },
  })
  if err != nil {
    t.Fatalf("expandFormatBlock: unexpected error: %v", err)
  }

  entry, ok := out["formatJsdoc"]
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
