package linthost

import "testing"

// TestUnicornNoHexEscapeReportsInterpolatedTemplateSegments verifies the rule
// inspects the head, middle, and tail elements of a substituted template.
//
// The engine dispatches strictly by a node's own Kind, and an interpolated
// template's literal segments parse as separate `KindTemplateHead`,
// `KindTemplateMiddle`, and `KindTemplateTail` tokens. The rule used to opt
// into `KindStringLiteral` and `KindNoSubstitutionTemplateLiteral` only, so
// every escape in an interpolated segment was silently ignored (issue
// #578). Each segment is pinned on its own, at its exact token range —
// opening backtick or `}` through the closing `${` or backtick — because a
// range that leaks into the substitution would underline live code. The
// comment arm is the negative twin of the tail arm: a template token's Pos
// starts at the substitution's trailing trivia, so a hex escape typed inside
// a comment must not be scanned.
//
//  1. Lint templates that carry the escape in the head, the middle, and the
//     tail segment, plus a template literal type and a no-substitution
//     template.
//  2. Assert one finding per segment, each spanning exactly its element token.
//  3. Assert a `\xHH` sequence inside a substitution comment reports nothing.
func TestUnicornNoHexEscapeReportsInterpolatedTemplateSegments(t *testing.T) {
  cases := []struct {
    name    string
    source  string
    markers []string
  }{
    {
      name:    "head segment",
      source:  "const t = `\\xA9${a}`;\n",
      markers: []string{"`\\xA9${"},
    },
    {
      name:    "middle segment",
      source:  "const t = `${a}\\xA9${a}`;\n",
      markers: []string{"}\\xA9${"},
    },
    {
      name:    "tail segment",
      source:  "const t = `${a}\\xA9`;\n",
      markers: []string{"}\\xA9`"},
    },
    {
      name:   "every segment of one template",
      source: "const t = `\\xA9${a}\\xA9${a}\\xA9`;\n",
      markers: []string{
        "`\\xA9${",
        "}\\xA9${",
        "}\\xA9`",
      },
    },
    {
      name:    "template literal type head",
      source:  "type T = `\\xA9${string}`;\n",
      markers: []string{"`\\xA9${"},
    },
    {
      name:   "template literal type middle and tail",
      source: "type T = `${string}\\xA9${string}\\xA9`;\n",
      markers: []string{
        "}\\xA9${",
        "}\\xA9`",
      },
    },
    {
      name:    "no-substitution template",
      source:  "const t = `\\xA9`;\n",
      markers: []string{"`\\xA9`"},
    },
    {
      name:   "escape inside a substitution comment",
      source: "const t = `${a /* \\xA9 */}`;\n",
    },
    {
      name:    "string literal inside a substitution",
      source:  "const t = `${\"\\xA9\"}`;\n",
      markers: []string{"\"\\xA9\""},
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleFindingRanges(t, unicornNoHexEscapeRuleName, test.source, test.markers...)
    })
  }
}
