package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestUnicornStringContentSelectorsRestrictCheckedNodes verifies the
// `selectors` option replaces the default Literal/TemplateElement listener.
//
// With selectors configured, upstream checks ONLY nodes reached by a
// selector, still filtered to string shapes; overlapping selectors must
// report a node once (upstream's `checked` WeakSet). The `description` vs
// `title` pair is the upstream suite's shape for both literal and template
// targets.
//
//  1. Lint two string declarations under a `VariableDeclarator[id.name]`
//     literal selector and assert only `description` is rewritten.
//  2. Repeat with a `TemplateElement` selector over template declarations.
//  3. Lint with two overlapping selectors and assert exactly one finding.
func TestUnicornStringContentSelectorsRestrictCheckedNodes(t *testing.T) {
  t.Run("literal selector", func(t *testing.T) {
    source := "const description = 'no';\nconst title = 'no';\n"
    options := `{"patterns":{"no":"yes"},"selectors":["VariableDeclarator[id.name=\"description\"] > Literal"]}`
    expected := "const description = 'yes';\nconst title = 'no';\n"
    assertFixSnapshotWithOptions(t, "unicorn/string-content", source, options, expected)
  })

  t.Run("template element selector", func(t *testing.T) {
    source := "const description = `no`;\nconst title = `no`;\n"
    options := `{"patterns":{"no":"yes"},"selectors":["VariableDeclarator[id.name=\"description\"] TemplateElement"]}`
    expected := "const description = `yes`;\nconst title = `no`;\n"
    assertFixSnapshotWithOptions(t, "unicorn/string-content", source, options, expected)
  })

  t.Run("property selector", func(t *testing.T) {
    source := "const metadata = {\n  description: 'no',\n  title: 'no',\n};\n"
    options := `{"patterns":{"no":"yes"},"selectors":["Property[key.name=\"description\"] > Literal"]}`
    expected := "const metadata = {\n  description: 'yes',\n  title: 'no',\n};\n"
    assertFixSnapshotWithOptions(t, "unicorn/string-content", source, options, expected)
  })

  t.Run("overlapping selectors report once", func(t *testing.T) {
    source := "const description = 'no';\nconst title = 'no';\n"
    options := `{"patterns":{"no":"yes"},"selectors":[` +
      `"VariableDeclarator[id.name=\"description\"] > Literal",` +
      `"VariableDeclarator[id.name=/description/] > Literal"]}`
    _, _, findings := runRuleFindingsSnapshot(t, "unicorn/string-content", source, json.RawMessage(options))
    if len(findings) != 1 {
      t.Fatalf("overlapping selectors must report one finding, got %d (%+v)", len(findings), findings)
    }
    if want := strings.Index(source, "'no'"); findings[0].Pos != want {
      t.Fatalf("finding start: want %d, got %d", want, findings[0].Pos)
    }
  })

  t.Run("selector matching a non-string node stays silent", func(t *testing.T) {
    source := "const description = 0;\nconst title = 'no';\n"
    options := `{"patterns":{"no":"yes"},"selectors":["VariableDeclarator[id.name=\"description\"] > Literal"]}`
    assertRuleSkipsSourceWithOptions(t, "unicorn/string-content", source, options)
  })
}
