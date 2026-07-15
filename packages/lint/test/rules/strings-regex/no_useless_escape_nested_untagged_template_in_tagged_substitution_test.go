package linthost

import "testing"

// TestNoUselessEscapeNestedUntaggedTemplateInTaggedSubstitution verifies the
// rule reports a useless escape in an untagged literal nested inside a tagged
// template's substitution.
//
// Pins issue #604: the tagged-template guard used to walk up to three ancestors
// for ANY TaggedTemplateExpression, so a literal nested in a tag's substitution
// was wrongly treated as tagged. The guard must instead consult the literal's
// OWN enclosing template (`isTaggedTemplateElement`). A tag only observes the
// raw bytes of its own quasis; a literal inside `${…}` is an ordinary
// expression the tag never sees raw, so its escapes are still noise.
//
//  1. Lint the issue's five-row matrix plus a nested string-literal control.
//  2. Assert each untagged literal (rows a, b, d, e, plus the string control)
//     reports exactly the backslash byte, while the directly-tagged row f
//     stays silent.
func TestNoUselessEscapeNestedUntaggedTemplateInTaggedSubstitution(t *testing.T) {
  backslash := []string{"\\"}
  cases := []struct {
    name    string
    source  string
    markers []string
  }{
    {
      name:    "a: plain string literal",
      source:  "const a = \"\\a\";\n",
      markers: backslash,
    },
    {
      name:    "b: untagged no-substitution template",
      source:  "const b = `\\a`;\n",
      markers: backslash,
    },
    {
      name:    "d: untagged inner template in an untagged outer template",
      source:  "const d = `x${`\\a`}y`;\n",
      markers: backslash,
    },
    {
      name:    "e: untagged inner template in a tagged outer template",
      source:  "const e = String.raw`x${`\\a`}y`;\n",
      markers: backslash,
    },
    {
      name:   "f: tagged no-substitution template stays silent",
      source: "const f = String.raw`\\a`;\n",
    },
    {
      name:    "string literal nested in a tagged substitution",
      source:  "const g = String.raw`${\"\\a\"}`;\n",
      markers: backslash,
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleFindingRanges(t, "no-useless-escape", test.source, test.markers...)
    })
  }
}
