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
