package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsInvalidJsdocOptions verifies expandFormatBlock returns
// errors for invalid values inside the `jsdoc` object sub-keys.
//
// Locks four error paths inside the jsdoc case:
//
//   - `tagSynonyms` must be a map[string]any; a non-object value (e.g. a bool)
//     triggers the `if !ok` guard.
//
//   - A tagSynonyms entry whose value is not a string (e.g. an int) triggers
//     the per-element type check.
//
//   - `sortTags` must be a boolean; a non-bool triggers the asBool error path.
//
//   - An unknown jsdoc key (e.g. "minify") triggers the default error arm.
//
//     1. Call expandFormatBlock with `jsdoc: { tagSynonyms: true }`.
//     2. Assert error mentioning `tagSynonyms`.
//     3. Call with `jsdoc: { tagSynonyms: { foo: 42 } }`.
//     4. Assert error mentioning `tagSynonyms[`.
//     5. Call with `jsdoc: { sortTags: "yes" }`.
//     6. Assert error naming `format.jsdoc.sortTags`.
//     7. Call with `jsdoc: { minify: true }`.
//     8. Assert error mentioning `minify`.
func TestFormatBlockRejectsInvalidJsdocOptions(t *testing.T) {
  cases := []struct {
    name      string
    raw       map[string]any
    wantInErr string
  }{
    {
      name:      "tagSynonyms not an object",
      raw:       map[string]any{"jsdoc": map[string]any{"tagSynonyms": true}},
      wantInErr: "tagSynonyms",
    },
    {
      name:      "tagSynonyms value not a string",
      raw:       map[string]any{"jsdoc": map[string]any{"tagSynonyms": map[string]any{"foo": 42}}},
      wantInErr: "tagSynonyms",
    },
    {
      name:      "sortTags not a bool",
      raw:       map[string]any{"jsdoc": map[string]any{"sortTags": "yes"}},
      wantInErr: "format.jsdoc.sortTags",
    },
    {
      name:      "unknown jsdoc key",
      raw:       map[string]any{"jsdoc": map[string]any{"minify": true}},
      wantInErr: "minify",
    },
  }

  for _, tc := range cases {
    _, err := expandFormatBlock(tc.raw)
    if err == nil {
      t.Errorf("%s: expected error, got nil", tc.name)
      continue
    }
    if !strings.Contains(err.Error(), tc.wantInErr) {
      t.Errorf("%s: want error containing %q, got %v", tc.name, tc.wantInErr, err)
    }
  }
}
