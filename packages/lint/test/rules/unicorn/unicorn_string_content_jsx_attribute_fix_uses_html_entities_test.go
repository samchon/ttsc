package linthost

import (
  "encoding/json"
  "os"
  "testing"
)

// TestUnicornStringContentJsxAttributeFixUsesHtmlEntities verifies JSX
// attribute strings encode the delimiter quote as an HTML entity.
//
// JSX attribute values do not support backslash escapes, so a replacement
// containing the delimiter quote must become `&#39;` / `&quot;` (which JSX
// decodes) instead of `\'` / `\"` — the quote-js-string path would corrupt
// the attribute. Non-delimiter quotes stay raw, matching upstream.
//
//  1. Lint a TSX file whose `className` matches the `quote` pattern with a
//     replacement containing both quote characters.
//  2. Fix the single- and double-quoted attribute variants.
//  3. Compare each rewritten attribute with the upstream entity spelling.
func TestUnicornStringContentJsxAttributeFixUsesHtmlEntities(t *testing.T) {
  options := `{"patterns":{"quote":{"suggest":"'\""}}}`
  cases := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name:     "single quoted attribute",
      source:   "const foo = <div className='quote' />;\n",
      expected: "const foo = <div className='&#39;\"' />;\n",
    },
    {
      name:     "double quoted attribute",
      source:   "const foo = <div className=\"quote\" />;\n",
      expected: "const foo = <div className=\"'&quot;\" />;\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      root, filePath, findings := runRuleFindingsSnapshotFile(
        t,
        "unicorn/string-content",
        "main.tsx",
        test.source,
        json.RawMessage(options),
      )
      if len(findings) != 1 {
        t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
      }
      fixed, err := applyFindingFixes(root, findings)
      if err != nil {
        t.Fatalf("applyFindingFixes: %v", err)
      }
      if fixed == 0 {
        t.Fatal("expected the JSX attribute fix to apply")
      }
      got, err := os.ReadFile(filePath)
      if err != nil {
        t.Fatalf("ReadFile: %v", err)
      }
      if string(got) != test.expected {
        t.Fatalf("fixed source mismatch:\nwant %q\ngot  %q", test.expected, string(got))
      }
      file := parseTSXFile(t, "/virtual/fixed-string-content-jsx.tsx", string(got))
      if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("fixed TSX has parse diagnostics: %+v\n%s", diagnostics, string(got))
      }
    })
  }

  // A quoted string INSIDE a JSX expression container is a plain literal:
  // the entity path must not leak beyond direct attribute values.
  t.Run("expression container keeps string escapes", func(t *testing.T) {
    source := "const foo = <div className={'quote'} />;\n"
    expected := "const foo = <div className={'\\'\"'} />;\n"
    root, filePath, findings := runRuleFindingsSnapshotFile(
      t,
      "unicorn/string-content",
      "main.tsx",
      source,
      json.RawMessage(options),
    )
    if len(findings) != 1 {
      t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
    }
    if _, err := applyFindingFixes(root, findings); err != nil {
      t.Fatalf("applyFindingFixes: %v", err)
    }
    got, err := os.ReadFile(filePath)
    if err != nil {
      t.Fatalf("ReadFile: %v", err)
    }
    if string(got) != expected {
      t.Fatalf("fixed source mismatch:\nwant %q\ngot  %q", expected, string(got))
    }
  })
}
