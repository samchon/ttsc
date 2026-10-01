package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

const noRestrictedTypesRuleName = "typescript/no-restricted-types"

func runNoRestrictedTypes(
  t *testing.T,
  source string,
  options json.RawMessage,
) []*Finding {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(
    t,
    noRestrictedTypesRuleName,
    source,
    options,
  )
  return findings
}

func noRestrictedTypesMarkedSpan(
  t *testing.T,
  source string,
  marker string,
  text string,
) [2]int {
  t.Helper()
  markerPos := strings.Index(source, marker)
  if markerPos < 0 || strings.LastIndex(source, marker) != markerPos {
    t.Fatalf("marker %q must occur exactly once", marker)
  }
  searchFrom := markerPos + len(marker)
  offset := strings.Index(source[searchFrom:], text)
  if offset < 0 {
    t.Fatalf("text %q not found after marker %q", text, marker)
  }
  start := searchFrom + offset
  return [2]int{start, start + len(text)}
}

func noRestrictedTypesAssertStableRewrite(
  t *testing.T,
  rewritten string,
  expected string,
  options json.RawMessage,
) {
  t.Helper()
  if rewritten != expected {
    t.Fatalf("rewrite mismatch:\nwant %q\ngot  %q", expected, rewritten)
  }
  file := parseTSFile(t, "/virtual/no-restricted-types-rewrite.ts", rewritten)
  if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("rewrite has parse diagnostics: %+v\n%s", diagnostics, rewritten)
  }
  if findings := runNoRestrictedTypes(t, rewritten, options); len(findings) != 0 {
    t.Fatalf("rewrite is not a clean fixed point: %+v\n%s", findings, rewritten)
  }
}
