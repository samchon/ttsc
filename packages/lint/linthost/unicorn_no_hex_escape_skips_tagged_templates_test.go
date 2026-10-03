package linthost

import "testing"

// TestUnicornNoHexEscapeSkipsTaggedTemplates verifies a tagged template's
// segments are never reported.
//
// Upstream guards its `TemplateElement` handler with
// `isTaggedTemplateLiteral(node.parent)`: the tag function receives the raw
// text (`String.raw`, `dedent`, `gql`), where `\xA9` and `©` are
// different strings, so rewriting the escape would change what the tag
// observes. Opting into the template elements without this guard would have
// turned every String.raw template carrying a hex escape into a fresh false
// positive. The guard stops at the element's own template: a literal nested
// inside a tagged template's substitution is not itself tagged and stays
// checked.
//
//  1. Lint tagged templates with and without substitutions.
//  2. Assert they report nothing while the untagged control does report.
//  3. Assert an untagged template and a string literal inside a tagged
//     template's substitution still report.
//
// @evidence contracts/testing.md#behavioral-verification Exact range and zero-finding assertions distinguish tag raw-text preservation from exemptions leaking into nested literals.
// @evidence contracts/testing.md#independent-expectations The supported tag exemption follows JavaScript raw template semantics: replacing hex spelling changes the string observed by the tag.
// @evidence contracts/testing.md#distinguishing-cases Tagged templates with and without substitutions stay clean; equivalent untagged templates and strings nested inside tagged substitutions remain checked.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoHexEscapeSkipsTaggedTemplates owns the explicit source matrix and any named t.Run variants as one discoverable Go unit entry. Parsing and actual engine calls share the Go test process; no installed consumer, native compilation or child product host is needed.
func TestUnicornNoHexEscapeSkipsTaggedTemplates(t *testing.T) {
  cases := []struct {
    name    string
    source  string
    markers []string
  }{
    {
      name:   "tagged no-substitution template",
      source: "const s = String.raw`\\xA9`;\n",
    },
    {
      name:   "tagged template with substitutions",
      source: "const s = String.raw`\\xA9${a}\\xA9${a}\\xA9`;\n",
    },
    {
      name:    "untagged control",
      source:  "const s = `\\xA9${a}`;\n",
      markers: []string{"`\\xA9${"},
    },
    {
      name:    "untagged template nested in a tagged substitution",
      source:  "const s = String.raw`${`\\xA9`}`;\n",
      markers: []string{"`\\xA9`"},
    },
    {
      name:    "string literal nested in a tagged substitution",
      source:  "const s = String.raw`${\"\\xA9\"}`;\n",
      markers: []string{"\"\\xA9\""},
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleFindingRanges(t, unicornNoHexEscapeRuleName, test.source, test.markers...)
    })
  }
}
