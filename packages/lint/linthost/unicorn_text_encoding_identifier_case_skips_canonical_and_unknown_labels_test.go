package linthost

import "testing"

// TestUnicornTextEncodingIdentifierCaseSkipsCanonicalAndUnknownLabels verifies
// the rule stays silent on the dash-less canonical spellings and on every label
// upstream does not handle.
//
// Each negative is a positive's twin one property away: `"utf8"` is the
// canonical form the inverted port used to flag (issue #596), `"ascii"` is
// already lowercase, and `"latin1"` / `"UTF-16LE"` / `"iso-8859-1"` /
// `"windows-1252"` are the encodings the old table wrongly invented. A canonical
// no-substitution template and the empty string guard the raw-slice path.
//
//  1. Feed the rule an already-canonical or unhandled encoding literal.
//  2. Assert the engine emits zero findings for it.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleSkipsSource requires zero findings for eight canonical or unsupported labels.
// @evidence contracts/testing.md#independent-expectations The literal zero oracle follows the supported label vocabulary, not a generated table copied from the product.
// @evidence contracts/testing.md#distinguishing-cases utf8/ascii, four unknown encodings, empty string and canonical template remain clean; TestRuleCorpusUnicornTextEncodingIdentifierCase owns the noncanonical twins.
// @evidence contracts/testing.md#execution-ownership TestUnicornTextEncodingIdentifierCaseSkipsCanonicalAndUnknownLabels is a discoverable Go unit host; its source/option fixtures exercise owning AST engine and fix operations in the shared Go process without consumer installation, native builds or product child hosts. Helper failures retain the source/expected fixture identity.
func TestUnicornTextEncodingIdentifierCaseSkipsCanonicalAndUnknownLabels(t *testing.T) {
  for _, source := range []string{
    "const enc = \"utf8\";\nvoid enc;\n",
    "const enc = \"ascii\";\nvoid enc;\n",
    "const enc = \"latin1\";\nvoid enc;\n",
    "const enc = \"UTF-16LE\";\nvoid enc;\n",
    "const enc = \"iso-8859-1\";\nvoid enc;\n",
    "const enc = \"windows-1252\";\nvoid enc;\n",
    "const enc = \"\";\nvoid enc;\n",
    "const enc = `utf8`;\nvoid enc;\n",
  } {
    assertRuleSkipsSource(t, unicornTextEncodingIdentifierCaseRuleName, source)
  }
}
