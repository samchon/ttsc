package driver

import "testing"

func TestSpliceCallConsumesRegexLiteralWithClosingParen(t *testing.T) {
  got := spliceForTest(t, `const out = plugin.make(/\)/, "ok");`)
  want := `const out = replacement;`
  if got != want {
    t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", want, got)
  }
}

func TestSpliceCallIgnoresClosingParenInsideBlockComment(t *testing.T) {
  got := spliceForTest(t, `const out = plugin.make(1 /* ) */, 2);`)
  want := `const out = replacement;`
  if got != want {
    t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", want, got)
  }
}

func TestSpliceCallIgnoresClosingParenInsideLineComment(t *testing.T) {
  got := spliceForTest(t, "const out = plugin.make(\n  1, // )\n  2\n);")
  want := `const out = replacement;`
  if got != want {
    t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", want, got)
  }
}

func TestSpliceCallKeepsDivisionOutsideRegexMode(t *testing.T) {
  got := spliceForTest(t, `const out = plugin.make(total / divisor, 2);`)
  want := `const out = replacement;`
  if got != want {
    t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", want, got)
  }
}

func spliceForTest(t *testing.T, text string) string {
  t.Helper()
  got, _, ok, err := spliceCall(text, Rewrite{
    RootName:      "plugin",
    Method:        "make",
    Replacement:   "replacement",
    ConsumeParens: true,
  }, 0)
  if err != nil {
    t.Fatal(err)
  }
  if !ok {
    t.Fatal("rewrite did not match")
  }
  return got
}
