package main

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSemiHonorsPreferNeverOption verifies the `prefer: "never"`
// branch strips trailing semicolons from ASI-safe statements while
// leaving class properties and type aliases alone.
//
// Stripping the `;` after a class field can change how the next token
// parses (e.g. `class A { x: number; [k](): void {} }` would reparse
// `[k]` as a computed index access on `number`). The rule's
// preferNeverSafeKind allowlist exists to pin that boundary. This test
// exercises both halves: an ASI-safe expression statement *and* a
// PropertyDeclaration in the same fixture and asserts the asymmetric
// rewrite.
//
// 1. Parse a file with both a statement and a class field, both ending
//    in `;`, with `prefer: "never"` configured.
// 2. Apply the rule's findings through the disk-backed fixer.
// 3. Assert the statement loses its `;` but the class field keeps it.
func TestFormatSemiHonorsPreferNeverOption(t *testing.T) {
  root := t.TempDir()
  filePath := filepath.Join(root, "src", "main.ts")
  source := "JSON.stringify(1);\nclass A { x: number = 0; }\n"
  writeFile(t, filePath, source)
  file := parseTSFile(t, filePath, source)

  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/semi": SeverityError},
    Options: RuleOptionsMap{
      "format/semi": json.RawMessage(`{"prefer":"never"}`),
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
  want := "JSON.stringify(1)\nclass A { x: number = 0; }\n"
  if string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
