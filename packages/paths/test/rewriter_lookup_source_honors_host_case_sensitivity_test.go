package paths_test

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestRewriterLookupSourceHonorsHostCaseSensitivity pins canonical lookup keys.
func TestRewriterLookupSourceHonorsHostCaseSensitivity(t *testing.T) {
  root := filepath.ToSlash(filepath.Join(t.TempDir(), "Repo"))
  sources := []string{
    root + "/src/exact.ts",
    root + "/src/extensionless.tsx",
    root + "/src/explicit.mts",
    root + "/src/directory/index.cts",
  }
  insensitive := &pathsRewriter{
    canonicalFileName: strings.ToLower,
    sourceFiles:       map[string]string{},
  }
  sensitive := &pathsRewriter{sourceFiles: map[string]string{}}
  for _, source := range sources {
    insensitive.sourceFiles[pathsSourceKey(insensitive, source)] = source
    sensitive.sourceFiles[pathsSourceKey(sensitive, source)] = source
  }

  cases := []struct {
    candidate string
    expected  string
  }{
    {root + "/SRC/EXACT.TS", sources[0]},
    {root + "/SRC/EXTENSIONLESS", sources[1]},
    {root + "/SRC/EXPLICIT.MTS", sources[2]},
    {root + "/SRC/DIRECTORY", sources[3]},
  }
  for _, tc := range cases {
    source, ok := pathsLookupSource(insensitive, tc.candidate)
    if !ok || source != tc.expected {
      t.Fatalf("case-insensitive lookup mismatch for %q: source=%q ok=%v", tc.candidate, source, ok)
    }
    if source, ok := pathsLookupSource(sensitive, tc.candidate); ok {
      t.Fatalf("case-sensitive lookup unexpectedly resolved %q to %q", tc.candidate, source)
    }
  }
}
