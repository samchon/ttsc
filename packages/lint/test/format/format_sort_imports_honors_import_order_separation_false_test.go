package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSortImportsHonorsImportOrderSeparationFalse verifies the
// blank-line separator toggle.
//
// `importOrderSeparation: false` collapses the canonical layout to a
// single newline between groups. Trivago documents the option as a
// tri-state (default true; explicitly false suppresses); the Go
// `*bool` decoding mirrors that contract. The rule's `\n\n` vs `\n`
// branch at the build step is the only thing protecting the contract.
//
// 1. Parse a file with external and relative imports.
// 2. Run the rule with `importOrderSeparation: false`.
// 3. Assert the rewritten output has no blank line between the groups.
func TestFormatSortImportsHonorsImportOrderSeparationFalse(t *testing.T) {
  root := t.TempDir()
  filePath := filepath.Join(root, "src", "main.ts")
  source := "import { x } from \"./local\";\n" +
    "import alpha from \"alpha\";\n" +
    "JSON.stringify({ x, alpha });\n"
  writeFile(t, filePath, source)
  file := parseTSFile(t, filePath, source)

  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/sort-imports": SeverityError},
    Options: RuleOptionsMap{
      "format/sort-imports": json.RawMessage(`{"importOrderSeparation":false}`),
    },
  }
  findings := NewEngineWithResolver(resolver).
    Run([]*shimast.SourceFile{file}, nil)
  if _, err := applyFindingFixes(root, findings); err != nil {
    t.Fatalf("applyFindingFixes: %v", err)
  }
  got, err := os.ReadFile(filePath)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  // External (alpha) comes first, relative (./local) second, no blank
  // line between them.
  if strings.Contains(string(got), "\";\n\nimport") {
    t.Fatalf("blank-line separator leaked with importOrderSeparation:false:\n%s", got)
  }
  if !strings.Contains(string(got), "\"alpha\";\nimport { x } from \"./local\";") {
    t.Fatalf("groups not collapsed to single newline:\n%s", got)
  }
}
