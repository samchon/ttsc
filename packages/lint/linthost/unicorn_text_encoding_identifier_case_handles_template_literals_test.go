package linthost

import "testing"

// TestUnicornTextEncodingIdentifierCaseHandlesTemplateLiterals verifies a
// non-substitution template carrying a non-canonical encoding reports and
// rewrites the text between its backticks, while a template that TAGS a call
// (a String.raw tagged template) is left alone.
//
// Upstream's getStringLiteralValue rejects a template whose parent is a
// TaggedTemplateExpression, because the tag owns the raw text; an untagged
// template behaves like a string literal. The edit must land inside the
// backticks so the delimiters survive.
//
//  1. Lint an untagged template literal and assert the suggestion edits its body.
//  2. Lint a tagged template with the same body and assert silence.
//
// @evidence contracts/testing.md#behavioral-verification the untagged encoding template receives one payload-only utf8 suggestion, while String.raw with the same payload is clean.
// @evidence contracts/testing.md#independent-expectations Authored replacement text and independently calculated payload bounds preserve backtick delimiters under supported raw-tag exclusion.
// @evidence contracts/testing.md#distinguishing-cases Only the untagged template body is editable; tagging the identical spelling with String.raw changes eligibility without changing its payload.
// @evidence contracts/testing.md#execution-ownership TestUnicornTextEncodingIdentifierCaseHandlesTemplateLiterals is a discoverable Go unit host; owning parsed-AST engine and suggestion observations run its literal fixtures in the shared process without installation, native builds or product children. Local table/helper failures retain the source, expected replacement or option payload identity.
func TestUnicornTextEncodingIdentifierCaseHandlesTemplateLiterals(t *testing.T) {
  source := "const enc = `utf-8`;\nvoid enc;\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornTextEncodingIdentifierCaseRuleName, source, nil)
  if len(findings) != 1 {
    t.Fatalf("untagged template: want 1 finding, got %d (%+v)", len(findings), findings)
  }
  if len(findings[0].Suggestions) != 1 || len(findings[0].Suggestions[0].Edits) != 1 {
    t.Fatalf("untagged template: want one suggestion edit, got %+v", findings[0].Suggestions)
  }
  edit := findings[0].Suggestions[0].Edits[0]
  if edit.Text != "utf8" {
    t.Fatalf("untagged template: want rewrite to `utf8`, got %q", edit.Text)
  }
  // The backticks sit at the delimiters; the edit must stay strictly inside.
  open := len("const enc = ")
  if edit.Pos != open+1 || edit.End != open+1+len("utf-8") {
    t.Fatalf("untagged template: edit want [%d,%d), got [%d,%d)", open+1, open+1+len("utf-8"), edit.Pos, edit.End)
  }

  assertRuleSkipsSource(
    t,
    unicornTextEncodingIdentifierCaseRuleName,
    "const enc = String.raw`utf-8`;\nvoid enc;\n",
  )
}
