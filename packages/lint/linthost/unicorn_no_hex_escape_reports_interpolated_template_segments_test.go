package linthost

import "testing"

// TestUnicornNoHexEscapeReportsInterpolatedTemplateSegments verifies the rule
// inspects the head, middle, and tail elements of a substituted template.
//
// Interpolated templates expose separate head, middle and tail tokens.
// Each authored marker spans its element delimiters, without the live
// substitution expression. A hex-looking sequence in substitution-comment
// trivia is an adjacent negative that must not produce a finding.
//
//  1. Lint templates that carry the escape in the head, the middle, and the
//     tail segment, plus a template literal type and a no-substitution
//     template.
//  2. Assert one finding per segment, each spanning exactly its element token.
//  3. Assert a `\xHH` sequence inside a substitution comment reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification Exact finding-range assertions expose skipped template elements and ranges that include substitution expressions or comments.
// @evidence contracts/testing.md#independent-expectations JavaScript head/middle/tail boundaries and the no-hex-escape policy independently establish the delimiter-inclusive markers.
// @evidence contracts/testing.md#distinguishing-cases Each and all template segments, template types, no-substitution templates and nested string literals report; hex-looking substitution comments stay clean.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoHexEscapeReportsInterpolatedTemplateSegments owns the explicit source matrix and any named t.Run variants as one discoverable Go unit entry. Parsing and actual engine calls share the Go test process; no installed consumer, native compilation or child product host is needed.
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
