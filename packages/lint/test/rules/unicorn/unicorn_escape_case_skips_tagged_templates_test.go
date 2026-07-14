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
