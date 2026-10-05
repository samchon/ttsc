package linthost

import (
  "strings"
  "testing"
)

// TestFormatBlockRejectsInvalidJsdocOptions verifies expandFormatBlock returns
// errors for invalid values inside the `jsDoc` object sub-keys.
//
// Four error paths inside the jsDoc case are locked. `tagSynonyms` must be an
// object, so a bool is rejected. A tagSynonyms entry whose value is not a
// string (an int here) is rejected by the per-element type check. `sortTags`
// must be a boolean, so a string is rejected. An unknown jsDoc key such as
// "minify" reaches the default error arm.
//
//  1. Call expandFormatBlock with `jsDoc: { tagSynonyms: true }` and assert the
//     error names `format.jsDoc.tagSynonyms`.
//  2. Call it with `jsDoc: { tagSynonyms: { foo: 42 } }` and assert the error
//     names `format.jsDoc.tagSynonyms["foo"]`.
//  3. Call it with `jsDoc: { sortTags: "yes" }` and assert the error names
//     `format.jsDoc.sortTags`.
//  4. Call it with `jsDoc: { minify: true }` and assert the error mentions
//     `minify`.
//
// @evidence contracts/testing.md#behavioral-verification expandFormatBlock rejects non-object tagSynonyms, a numeric synonym value, non-Boolean sortTags, and unknown minify key with the matching field context.
// @evidence contracts/testing.md#independent-expectations The public JSDoc object admits string-valued synonyms and Boolean sortTags only; the four independently authored malformed values establish their exact rejection contexts.
// @evidence contracts/testing.md#distinguishing-cases Owns wrong nested container, wrong map-element type, wrong Boolean option and unknown key; valid synonym and sortTags propagation are separate tests.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns four authored malformed JSDoc objects, calling expandFormatBlock directly and observing exact nested-field errors in the shared lint process; no source formatting or config script host is needed for validation.
func TestFormatBlockRejectsInvalidJsdocOptions(t *testing.T) {
  cases := []struct {
    name      string
    raw       map[string]any
    wantInErr string
  }{
    {
      name:      "tagSynonyms not an object",
      raw:       map[string]any{"jsDoc": map[string]any{"tagSynonyms": true}},
      wantInErr: "format.jsDoc.tagSynonyms",
    },
    {
      name:      "tagSynonyms value not a string",
      raw:       map[string]any{"jsDoc": map[string]any{"tagSynonyms": map[string]any{"foo": 42}}},
      wantInErr: `format.jsDoc.tagSynonyms["foo"]`,
    },
    {
      name:      "sortTags not a bool",
      raw:       map[string]any{"jsDoc": map[string]any{"sortTags": "yes"}},
      wantInErr: "format.jsDoc.sortTags",
    },
    {
      name:      "unknown jsDoc key",
      raw:       map[string]any{"jsDoc": map[string]any{"minify": true}},
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
