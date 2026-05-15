package main

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaHonorsModeES5Option verifies the ES5 branch.
//
// Prettier's `trailingComma: "es5"` adds commas only to array and
// object literals — the constructs ES5 itself accepts. Function
// parameters, function calls, tuple types, and named imports are all
// skipped because ES5 grammar disallowed trailing commas there. This
// scenario pins each excluded kind: a multi-line function with
// parameters that would otherwise gain a trailing comma stays unchanged,
// while a multi-line array literal in the same file does gain one.
//
//  1. Parse a file mixing a multi-line array and a multi-line function
//     declaration, with `mode: "es5"` configured.
//  2. Apply the rule's findings.
//  3. Assert the array gains a trailing comma but the parameter list
//     does not.
func TestFormatTrailingCommaHonorsModeES5Option(t *testing.T) {
  root := t.TempDir()
  filePath := filepath.Join(root, "src", "main.ts")
  source := "const xs = [\n  1,\n  2\n];\n" +
    "function f(\n  a: number,\n  b: number\n): number { return a + b; }\n" +
    "f(1, 2);\n"
  writeFile(t, filePath, source)
  file := parseTSFile(t, filePath, source)

  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/trailing-comma": SeverityError},
    Options: RuleOptionsMap{
      "format/trailing-comma": json.RawMessage(`{"mode":"es5"}`),
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
  // Array gains comma; function parameter list does not.
  want := "const xs = [\n  1,\n  2,\n];\n" +
    "function f(\n  a: number,\n  b: number\n): number { return a + b; }\n" +
    "f(1, 2);\n"
  if string(got) != want {
    t.Fatalf("formatted source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
