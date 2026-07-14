package linthost

import "testing"

// TestUnicornStringContentSkipsIgnoredTemplateTags verifies the
// foreign-language tag exemption and its exact boundaries.
//
// Upstream ignores quasis under the `gql`/`html`/`sql`/`svg` identifier tags
// and member-expression tags whose OBJECT is the identifier `styled`. The
// boundary matters both ways: `bar.html` and a computed `'styled'[div]`
// (object is a string literal, not an identifier) are NOT exempt, and the
// exemption never reaches plain string literals inside substitutions.
//
//  1. Assert every ignored tag shape stays silent under `{no: "yes"}`.
//  2. Assert each near-miss tag shape still reports and fixes.
//  3. Assert a string literal inside an ignored template's substitution is
//     still rewritten (the exemption is quasi-only).
func TestUnicornStringContentSkipsIgnoredTemplateTags(t *testing.T) {
  options := `{"patterns":{"no":"yes"}}`
  declarations := "declare function gql(strings: TemplateStringsArray, ...values: unknown[]): string;\n" +
    "declare function html(strings: TemplateStringsArray, ...values: unknown[]): string;\n" +
    "declare function sql(strings: TemplateStringsArray, ...values: unknown[]): string;\n" +
    "declare function svg(strings: TemplateStringsArray, ...values: unknown[]): string;\n" +
    "declare const styled: Record<string, (strings: TemplateStringsArray, ...values: unknown[]) => string> & { div(strings: TemplateStringsArray, ...values: unknown[]): string };\n"

  ignored := []struct {
    name   string
    source string
  }{
    {name: "gql tag", source: "const a = gql`{ field(input: 'no') }`;\n"},
    {name: "html tag", source: "const a = html`<div class='test'>no</div>`;\n"},
    {name: "sql tag", source: "const a = sql`SELECT * FROM users WHERE email = 'no'`;\n"},
    {name: "svg tag", source: "const a = svg`<text>no</text>`;\n"},
    {name: "styled member tag", source: "const a = styled.div`background: url('no')`;\n"},
    {name: "styled computed member tag", source: "const a = styled[\"div\"]`background: url('no')`;\n"},
    {name: "parenthesized ignored tag", source: "const a = (gql)`{ field(input: 'no') }`;\n"},
    {name: "ignored tag with substitutions", source: "declare const v: string;\nconst a = gql`no${v}no`;\n"},
  }
  for _, test := range ignored {
    t.Run("ignored "+test.name, func(t *testing.T) {
      assertRuleSkipsSourceWithOptions(t, "unicorn/string-content", declarations+test.source, options)
    })
  }

  reported := []struct {
    name     string
    source   string
    expected string
  }{
    {
      name:     "unlisted tag",
      source:   "declare function notIgnoredTag(strings: TemplateStringsArray): string;\nconst a = notIgnoredTag`no`;\n",
      expected: "declare function notIgnoredTag(strings: TemplateStringsArray): string;\nconst a = notIgnoredTag`yes`;\n",
    },
    {
      name:     "member tag on a non-styled object",
      source:   "declare const bar: { html(strings: TemplateStringsArray): string };\nconst a = bar.html`background: url('no')`;\n",
      expected: "declare const bar: { html(strings: TemplateStringsArray): string };\nconst a = bar.html`background: url('yes')`;\n",
    },
    {
      name:     "computed tag whose object is a string literal",
      source:   "declare const div: string;\nconst a = 'styled'[div]`background: url('no')`;\n",
      expected: "declare const div: string;\nconst a = 'styled'[div]`background: url('yes')`;\n",
    },
    {
      name:     "string literal inside an ignored template substitution",
      source:   "declare function html(strings: TemplateStringsArray, ...values: unknown[]): string;\nconst a = html`<div>${'no'}</div>`;\n",
      expected: "declare function html(strings: TemplateStringsArray, ...values: unknown[]): string;\nconst a = html`<div>${'yes'}</div>`;\n",
    },
  }
  for _, test := range reported {
    t.Run("reported "+test.name, func(t *testing.T) {
      assertFixSnapshotWithOptions(t, "unicorn/string-content", test.source, options, test.expected)
    })
  }
}
