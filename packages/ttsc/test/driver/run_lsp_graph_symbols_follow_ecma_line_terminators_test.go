package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graphsymbols"
)

// TestRunLSPGraphSymbolsFollowECMALineTerminators verifies graph-backed
// document symbols and references retain their real lines for every
// ECMAScript line terminator.
//
// Document-symbol and reference answers are distinct graph-provider paths: the
// first must skip a leading // comment before building a range, while the second
// must map an editor cursor back to the declaration and then map its edge spans
// forward. Both had their own CR-only failure mode.
//
// 1. Compile the same comment-plus-two-functions source under each separator.
// 2. Ask the graph SymbolProvider for document symbols and the beta references.
// 3. Assert declaration ranges and the call/declaration locations stay on lines 1 and 2.
func TestRunLSPGraphSymbolsFollowECMALineTerminators(t *testing.T) {
  cases := []struct {
    name       string
    terminator string
  }{
    {name: "LF", terminator: "\n"},
    {name: "CRLF", terminator: "\r\n"},
    {name: "CR", terminator: "\r"},
    {name: "LS", terminator: "\u2028"},
    {name: "PS", terminator: "\u2029"},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      source := "// lead comment" + tc.terminator +
        "export function alpha(): number { return beta(); }" + tc.terminator +
        "export function beta(): number { return 1; }"
      root, mainURI := writeGraphSymbolProject(t, source)
      provider := graphsymbols.NewProvider(root, "tsconfig.json")

      symbols, err := provider.DocumentSymbols(mainURI)
      if err != nil {
        t.Fatalf("DocumentSymbols: %v", err)
      }
      byName := map[string]driver.LSPDocumentSymbol{}
      for _, symbol := range symbols {
        byName[symbol.Name] = symbol
      }
      for name, line := range map[string]int{"alpha": 1, "beta": 2} {
        symbol, ok := byName[name]
        if !ok {
          t.Fatalf("missing %s document symbol: %+v", name, symbols)
        }
        if symbol.Range.Start.Line != line || symbol.Range.End.Line != line {
          t.Fatalf("%s range = %+v, want both endpoints on line %d", name, symbol.Range, line)
        }
      }

      locations, err := provider.References(
        mainURI,
        driver.LSPPosition{Line: 2, Character: 17},
        true,
      )
      if err != nil {
        t.Fatalf("References: %v", err)
      }
      lines := map[int]bool{}
      for _, location := range locations {
        lines[location.Range.Start.Line] = true
      }
      if len(locations) != 2 || !lines[1] || !lines[2] {
        t.Fatalf("beta references = %+v, want call on line 1 and declaration on line 2", locations)
      }
    })
  }
}
