package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentDescriptionLengthCountsGraphemeClusters verifies
// description length is measured in grapheme clusters, not runes or bytes.
//
// Upstream counts Intl.Segmenter segments: a single family emoji (seven
// code points joined with ZWJs) is ONE character and fails the default
// three-character minimum, while three of them pass. A rune- or
// byte-based counter would silently accept the single emoji. Combining
// marks pin the same property for decomposed Latin text.
//
// 1. Assert one family emoji reports requires-description (1 < 3).
// 2. Assert three family emoji pass (3 >= 3).
// 3. Assert two decomposed `é` report while three pass.
func TestBanTsCommentDescriptionLengthCountsGraphemeClusters(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  family := "\U0001F468\u200D\U0001F469\u200D\U0001F467\u200D\U0001F466"
  eAcute := "e\u0301"

  reportShort := func(description string) {
    t.Helper()
    source := "// @ts-expect-error " + description + "\nconst a: number = 1;\nJSON.stringify(a);\n"
    file := parseTS(t, source)
    findings := NewEngine(RuleConfig{ruleName: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
    if len(findings) != 1 {
      t.Fatalf("%q: want 1 finding, got %d (%+v)", description, len(findings), findings)
    }
    if !strings.Contains(findings[0].Message, "must be 3 characters or longer") {
      t.Fatalf("%q: want the requires-description message, got %q", description, findings[0].Message)
    }
  }

  reportShort(family)
  reportShort(strings.Repeat(eAcute, 2))

  assertRuleSkipsSource(
    t,
    ruleName,
    "// @ts-expect-error "+strings.Repeat(family, 3)+"\nconst a: number = 1;\nJSON.stringify(a);\n",
  )
  assertRuleSkipsSource(
    t,
    ruleName,
    "// @ts-expect-error "+strings.Repeat(eAcute, 3)+"\nconst a: number = 1;\nJSON.stringify(a);\n",
  )
}
