package linthost

import (
  "path/filepath"
  "testing"
)

// TestMatchAnyPatternAcceptsNativeAndSlashSeparators verifies that a file
// name spelled with the OS-native separator and one spelled with forward
// slashes both match the same slash-normalized ignore glob.
//
// The engine hands ResolveRules absolute paths whose separator depends on the
// producer: tsgo file names arrive slash-normalized while config discovery
// and LSP conversions produce `filepath.Join`-built native paths (backslashes
// on Windows). matchAnyPattern normalizes both sides via `filepath.ToSlash`
// before matching; a regression that compared raw separators would silently
// disable every ignore on exactly one platform.
//
//  1. Build the same ignored file path once with filepath.Join (native) and
//     once with forward slashes.
//  2. Match both spellings, plus a non-ignored sibling in both spellings.
//  3. Assert the ignored file matches in either spelling and the sibling
//     matches in neither.
func TestMatchAnyPatternAcceptsNativeAndSlashSeparators(t *testing.T) {
  base := filepath.Join(string(filepath.Separator), "project")
  patterns := []string{".next/**/*.ts"}
  ignoredNative := filepath.Join(base, ".next", "types", "validator.ts")
  ignoredSlash := filepath.ToSlash(ignoredNative)
  sourceNative := filepath.Join(base, "src", "main.ts")
  sourceSlash := filepath.ToSlash(sourceNative)

  for _, file := range []string{ignoredNative, ignoredSlash} {
    if !matchAnyPattern(base, patterns, file) {
      t.Errorf("matchAnyPattern(%q): ignored file must match", file)
    }
  }
  for _, file := range []string{sourceNative, sourceSlash} {
    if matchAnyPattern(base, patterns, file) {
      t.Errorf("matchAnyPattern(%q): source file must not match", file)
    }
  }
}
