package main

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatQuotesHonorsPreferSingleOption verifies that the `prefer:
// "single"` option flips format/quotes' direction.
//
// The default behavior converts single-quoted literals to double-quoted.
// Passing `{ prefer: "single" }` flips the contract: double-quoted
// literals convert to single-quoted (still subject to the escape-cost
// tie-breaker). This scenario locks the InlineRuleResolver options path
// end-to-end — JSON blob → DecodeOptions → behavioral switch — without
// touching the engine internals directly.
//
// 1. Parse a double-quoted literal with `prefer: "single"` configured.
// 2. Apply the rule's edits through the disk-backed fixer.
// 3. Assert the literal is now single-quoted.
func TestFormatQuotesHonorsPreferSingleOption(t *testing.T) {
  root := t.TempDir()
  filePath := filepath.Join(root, "src", "main.ts")
  source := "const greeting = \"hello\";\nJSON.stringify(greeting);\n"
  writeFile(t, filePath, source)
  file := parseTSFile(t, filePath, source)

  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/quotes": SeverityError},
    Options: RuleOptionsMap{
      "format/quotes": json.RawMessage(`{"prefer":"single"}`),
    },
  }
  findings := NewEngineWithResolver(resolver).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) == 0 {
    t.Fatalf("expected at least one finding")
  }
  fixed, err := applyFindingFixes(root, findings)
  if err != nil || fixed == 0 {
    t.Fatalf("applyFindingFixes: fixed=%d err=%v", fixed, err)
  }
  got, err := os.ReadFile(filePath)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  want := "const greeting = 'hello';\nJSON.stringify(greeting);\n"
  if string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
