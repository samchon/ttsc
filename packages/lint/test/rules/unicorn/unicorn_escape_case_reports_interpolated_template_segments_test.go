package linthost

import "testing"

// TestUnicornEscapeCaseReportsInterpolatedTemplateSegments verifies the rule
// inspects the head, middle, and tail elements of a substituted template.
//
// The engine dispatches strictly by a node's own Kind, and an interpolated
// template's literal segments parse as separate `KindTemplateHead`,
// `KindTemplateMiddle`, and `KindTemplateTail` tokens. The rule used to opt
// into `KindStringLiteral` and `KindNoSubstitutionTemplateLiteral` only, so
// every lowercase escape in an interpolated segment was silently ignored
// (issue #578). Each segment is pinned on its own, at its exact token range —
// opening backtick or `}` through the closing `${` or backtick — because a
// range that leaks into the substitution would underline live code. The
// comment arm is the negative twin of the tail arm: a template token's Pos
// starts at the substitution's trailing trivia, so a lowercase escape typed
// inside a comment must not be scanned.
//
//  1. Lint templates that carry the escape in the head, the middle, and the
//     tail segment, plus a template literal type and a no-substitution
//     template.
//  2. Assert one finding per segment, each spanning exactly its element token.
//  3. Assert an escape inside a substitution comment reports nothing.
func TestUnicornEscapeCaseReportsInterpolatedTemplateSegments(t *testing.T) {
  cases := []struct {
    name    string
    source  string
    markers []string
  }{
    {
      name:    "head segment",
      source:  "const t = `\\xa9${a}`;\n",
      markers: []string{"`\\xa9${"},
    },
    {
      name:    "middle segment",
      source:  "const t = `${a}\\xa9${a}`;\n",
      markers: []string{"}\\xa9${"},
    },
    {
      name:    "tail segment",
      source:  "const t = `${a}\\xa9`;\n",
      markers: []string{"}\\xa9`"},
    },
    {
      name:   "every segment of one template",
      source: "const t = `\\xa9${a}\\uabcd${a}\\u{1f600}`;\n",
      markers: []string{
        "`\\xa9${",
        "}\\uabcd${",
        "}\\u{1f600}`",
      },
    },
    {
      name:    "template literal type head",
      source:  "type T = `\\xa9${string}`;\n",
      markers: []string{"`\\xa9${"},
    },
    {
      name:   "template literal type middle and tail",
      source: "type T = `${string}\\xa9${string}\\xa9`;\n",
      markers: []string{
        "}\\xa9${",
        "}\\xa9`",
      },
    },
    {
      name:    "no-substitution template",
      source:  "const t = `\\xa9`;\n",
      markers: []string{"`\\xa9`"},
    },
    {
      name:   "escape inside a substitution comment",
      source: "const t = `${a /* \\xa9 */}`;\n",
    },
    {
      name:    "string literal inside a substitution",
      source:  "const t = `${\"\\xa9\"}`;\n",
      markers: []string{"\"\\xa9\""},
    },
    {
      name:   "canonical segments",
      source: "const t = `\\xA9${a}\\uABCD${a}\\u{1F600}`;\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleFindingRanges(t, unicornEscapeCaseRuleName, test.source, test.markers...)
    })
  }
}
