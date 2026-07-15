package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteSkipsNonASCIIIdentifierPrefix verifies the call-boundary
// guard rejects a match that begins mid-identifier after a non-ASCII character.
//
// findCallMatch used to widen the single byte at text[matchStart-1] into a rune.
// For a multi-byte identifier character that byte is a UTF-8 continuation/lead
// byte, not the character, so isIdentifierPart returned false, the boundary
// guard was bypassed, and `étypia.assert(` matched as the tail `typia.assert(`
// of a larger identifier — splicing the replacement into the middle of a
// distinct name and silently corrupting the emitted JS. Decoding the whole
// preceding rune restores the guard for BMP and astral prefixes alike, while
// the ASCII `mytypia` negative and a bare positive call pin both sides.
//
//  1. Splice `typia.assert(` against inputs whose call head is the trailing
//     substring of a longer identifier ending in `typia`.
//  2. Cover an ASCII prefix, BMP (`é`, `한`), and astral (`𝒜`) prefixes.
//  3. Assert none match, and that a boundary-clean `typia.assert(` still does.
func TestDriverRewriteSkipsNonASCIIIdentifierPrefix(t *testing.T) {
  rewrite := driver.Rewrite{
    RootName:      "typia",
    Method:        "assert",
    Replacement:   "__REPLACED__",
    ConsumeParens: true,
  }
  for _, prefix := range []string{"my", "é", "한", "𝒜"} {
    text := "const x = " + prefix + "typia.assert(input);"
    got, _, ok, err := spliceCall(text, rewrite, 0)
    if err != nil {
      t.Fatalf("prefix %q: unexpected error: %v", prefix, err)
    }
    if ok {
      t.Fatalf("prefix %q: guard bypassed, spliced mid-identifier:\n%s", prefix, got)
    }
    if got != text {
      t.Fatalf("prefix %q: no-match must leave text untouched:\n%s", prefix, got)
    }
  }

  positive := "const x = typia.assert(input);"
  got, _, ok, err := spliceCall(positive, rewrite, 0)
  if err != nil {
    t.Fatalf("positive control: unexpected error: %v", err)
  }
  if !ok {
    t.Fatal("positive control: boundary-clean typia.assert( did not match")
  }
  if !strings.Contains(got, "__REPLACED__") || strings.Contains(got, "typia.assert") {
    t.Fatalf("positive control: call was not replaced:\n%s", got)
  }
}
