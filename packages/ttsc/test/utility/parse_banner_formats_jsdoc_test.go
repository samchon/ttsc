package ttsc_test

import (
  "strings"
  "testing"
)

// TestUtilityParseBannerFormatsAndSanitizesJSDoc verifies banner text
// normalization.
//
// Banner text becomes a source preamble comment, so raw line endings, trailing
// empty lines, and embedded JSDoc terminators need deterministic handling
// before the compiler writes transformed files.
//
// This scenario keeps the formatter branch covered without requiring a full
// project emit. Public banner tests cover command-level loading and injection
// around the same normalized text.
//
// 1. Parse inline banner text containing CRLF, trailing blanks, and `*/`.
// 2. Inspect the generated JSDoc preamble.
// 3. Assert normalized lines, sanitized terminators, and a closed block.
func TestUtilityParseBannerFormatsAndSanitizesJSDoc(t *testing.T) {
  banner, err := utilityParseBanner(map[string]any{
    "text": "first\r\nsecond */\n\n",
  }, t.TempDir(), "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(banner, " * first\n * second * /\n") {
    t.Fatalf("banner was not normalized and sanitized:\n%s", banner)
  }
  if strings.Contains(banner, "second */") {
    t.Fatalf("banner must not preserve raw JSDoc terminator:\n%s", banner)
  }
  if !strings.HasSuffix(banner, "*/\n") {
    t.Fatalf("banner must end with a closed JSDoc block:\n%s", banner)
  }
}
