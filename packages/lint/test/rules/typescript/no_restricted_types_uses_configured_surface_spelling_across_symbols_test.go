package linthost

import (
  "testing"
  "encoding/json"
  "strings"
)

// @evidence contracts/testing.md#behavioral-verification Type matching must use configured source spelling rather than unrelated declaration identity.
// @evidence contracts/testing.md#independent-expectations Local and imported spellings have authored counts; the authored final type-name occurrence fixes its complete range and default message, rule and error severity.
// @evidence contracts/testing.md#distinguishing-cases Shadowed and Imported are banned by their written names; configuring original export Remote leaves Imported clean.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedTypesUsesConfiguredSurfaceSpellingAcrossSymbols invokes the registered rule over an in-process parsed source through runRuleFindingsSnapshot; no native plugin build, compiler child or installation is involved.
func TestNoRestrictedTypesUsesConfiguredSurfaceSpellingAcrossSymbols(t *testing.T) {
  tests := []struct {
    name    string
    source  string
    options json.RawMessage
    want    int
  }{
    {
      name: "local declaration is still restricted",
      source: `interface Shadowed {}
type Use = Shadowed;
`,
      options: json.RawMessage(`{"types":{"Shadowed":true}}`),
      want:    1,
    },
    {
      name: "imported alias spelling is restricted",
      source: `import type { Remote as Imported } from "pkg";
type Use = Imported;
`,
      options: json.RawMessage(`{"types":{"Imported":true}}`),
      want:    1,
    },
    {
      name: "original export name does not replace alias spelling",
      source: `import type { Remote as Imported } from "pkg";
type Use = Imported;
`,
      options: json.RawMessage(`{"types":{"Remote":true}}`),
    },
  }
  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      findings := runNoRestrictedTypes(t, test.source, test.options)
      if len(findings) != test.want {
        t.Fatalf("findings = %d, want %d: %+v", len(findings), test.want, findings)
      }
      if test.want == 1 {
        name := "Shadowed"
        if strings.Contains(test.source, "Imported") { name = "Imported" }
        start := strings.LastIndex(test.source, name)
        finding := findings[0]
        if finding.Rule != noRestrictedTypesRuleName || finding.Severity != SeverityError || finding.Pos != start || finding.End != start+len(name) || finding.Message != "Don't use "+string(rune(96))+name+string(rune(96))+" as a type." { t.Fatalf("surface spelling finding = %+v, want %q at %d", finding, name, start) }
      }
    })
  }
}
