package linthost

import "testing"

// TestUnicornConsistentTemplateLiteralEscapeHonorsBackslashParity verifies
// the even-backslash lookbehind of the upstream regex on runs the
// snapshot corpus does not reach.
//
// The scan may only treat `\$` as an escaped dollar when that backslash
// follows an even-length backslash run; otherwise the backslash is the
// second byte of an escaped `\\` and the dollar stands alone. Each fix
// arm has a skip twin one backslash away, so a parity miscount fires in
// one direction or the other.
//
//  1. Feed templates with two, three, and four leading backslashes before
//     the escape.
//  2. Fix arms must produce the canonical spelling byte-for-byte and stay
//     silent afterwards.
//  3. Skip arms must produce zero findings.
func TestUnicornConsistentTemplateLiteralEscapeHonorsBackslashParity(t *testing.T) {
  cases := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name:     "four backslashes then brace escape",
      source:   "const s = `\\\\\\\\$\\{a}`;\n",
      expected: "const s = `\\\\\\\\\\${a}`;\n",
    },
    {
      name:     "four backslashes then both escaped",
      source:   "const s = `\\\\\\\\\\$\\{a}`;\n",
      expected: "const s = `\\\\\\\\\\${a}`;\n",
    },
    {
      name:   "escaped backslash then real substitution",
      source: "const s = `\\\\${a}`;\n",
    },
    {
      name:   "escaped dollar then escaped backslash then brace",
      source: "const s = `\\$\\\\{a}`;\n",
    },
    {
      name:   "three backslashes then canonical escape",
      source: "const s = `\\\\\\${a}`;\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      if test.expected == "" {
        assertRuleSkipsSource(t, unicornConsistentTemplateLiteralEscapeRuleName, test.source)
        return
      }
      assertFixSnapshot(t, unicornConsistentTemplateLiteralEscapeRuleName, test.source, test.expected)
      assertRuleSkipsSource(t, unicornConsistentTemplateLiteralEscapeRuleName, test.expected)
    })
  }
}
