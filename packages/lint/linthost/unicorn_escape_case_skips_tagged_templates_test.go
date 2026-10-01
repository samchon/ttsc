package linthost

import "testing"

// TestUnicornEscapeCaseSkipsTaggedTemplates verifies a tagged template's
// segments are never reported.
//
// Upstream guards its `TemplateElement` handler with
// `isTaggedTemplateLiteral(node.parent)`: the tag function receives the raw
// text (`String.raw`, `dedent`, `gql`), where `\xa9` is a four-character
// string and `\xA9` a different one, so uppercasing the digits would change
// what the tag observes. Opting into the template elements without this guard
// would have turned every String.raw template carrying a lowercase escape into
// a fresh false positive. The guard stops at the element's own template: a
// literal nested inside a tagged template's substitution is not itself tagged
// and stays checked.
//
//  1. Lint tagged templates with and without substitutions.
//  2. Assert they report nothing while the untagged control does report.
//  3. Assert an untagged template and a string literal inside a tagged
//     template's substitution still report.
//
// @evidence contracts/testing.md#behavioral-verification Exact range and zero-finding assertions distinguish raw tagged-template text from independently checked substitution literals.
// @evidence contracts/testing.md#independent-expectations The supported tag exemption follows JavaScript raw template semantics: changing escape spelling changes the raw text supplied to a tag.
// @evidence contracts/testing.md#distinguishing-cases Tagged templates with and without substitutions stay clean; untagged controls and nested untagged/string substitution literals remain checked.
// @evidence contracts/testing.md#execution-ownership TestUnicornEscapeCaseSkipsTaggedTemplates owns the explicit source matrix and any named t.Run variants as one discoverable Go unit entry. Parsing and actual engine calls share the Go test process; no installed consumer, native compilation or child product host is needed.
func TestUnicornEscapeCaseSkipsTaggedTemplates(t *testing.T) {
  cases := []struct {
    name    string
    source  string
    markers []string
  }{
    {
      name:   "tagged no-substitution template",
      source: "const s = String.raw`\\xa9`;\n",
    },
    {
      name:   "tagged template with substitutions",
      source: "const s = String.raw`\\xa9${a}\\uabcd${a}\\u{1f600}`;\n",
    },
    {
      name:    "untagged control",
      source:  "const s = `\\xa9${a}`;\n",
      markers: []string{"`\\xa9${"},
    },
    {
      name:    "untagged template nested in a tagged substitution",
      source:  "const s = String.raw`${`\\xa9`}`;\n",
      markers: []string{"`\\xa9`"},
    },
    {
      name:    "string literal nested in a tagged substitution",
      source:  "const s = String.raw`${\"\\xa9\"}`;\n",
      markers: []string{"\"\\xa9\""},
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleFindingRanges(t, unicornEscapeCaseRuleName, test.source, test.markers...)
    })
  }
}
