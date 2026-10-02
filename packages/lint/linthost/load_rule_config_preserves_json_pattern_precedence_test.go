package linthost

import (
  "os"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestLoadRuleConfigPreservesJSONPatternPrecedence verifies authored JSON
// pattern precedence survives config discovery and native rule execution.
//
// String-content applies the first matching pattern in JavaScript property
// enumeration order. Loading the configuration through an unordered map must
// not substitute lexical sorting for the authored non-integer key order.
//
// 1. Write each ordered pattern object and a source with an unmatched control.
// 2. Discover the JSON configuration and require an active, valid native rule.
// 3. Apply the actual finding and compare the complete file with literal output.
//
// @evidence contracts/testing.md#behavioral-verification LoadConfigResolver discovers the authored lint.config.json, NewEngineWithResolver.Run executes string-content, and applyFindingFixes writes its real edit. Exactly one error finding and one edit must produce the complete expected file while preserving the unmatched literal.
// @evidence contracts/testing.md#independent-expectations The Unicorn first-matching-pattern contract and JavaScript property enumeration define literal outputs: reversing two non-integer keys reverses their winner, integer keys precede string keys, and a duplicate key retains its original position with its last value.
// @evidence contracts/testing.md#distinguishing-cases Opposite foo$/foo orders distinguish insertion order from lexical sorting; b/1 distinguishes integer enumeration from raw spelling order; duplicate foo$ distinguishes last-value replacement from repositioning. Each input includes an unmatched literal which must remain byte-identical, and active-rule checks prevent a disabled rule from passing.
// @evidence contracts/testing.md#execution-ownership This selected Go Test entry owns four named subcases and directly calls config discovery, the parser, engine and fix applier in one process with t.TempDir files. No consumer installation, native artifact build or product host is started.
func TestLoadRuleConfigPreservesJSONPatternPrecedence(t *testing.T) {
  cases := []struct {
    name     string
    patterns string
    value    string
    expected string
  }{
    {"non-integer first spelling", `{"foo$":"first","foo":"second"}`, "foo", "first"},
    {"non-integer reverse spelling", `{"foo":"second","foo$":"first"}`, "foo", "second"},
    {"integer before string", `{"b":"bee","1":"one"}`, "b1", "bone"},
    {"duplicate preserves position and last value", `{"foo$":"old","foo":"second","foo$":"last"}`, "foo", "last"},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      root := t.TempDir()
      filePath := filepath.Join(root, "main.ts")
      source := "const value = \"" + test.value + "\";\nconst untouched = \"untouched\";\n"
      expected := "const value = \"" + test.expected + "\";\nconst untouched = \"untouched\";\n"
      writeFile(t, filepath.Join(root, "tsconfig.json"), "{}")
      writeFile(t, filepath.Join(root, "lint.config.json"), `{"rules":{"unicorn/string-content":["error",{"patterns":`+test.patterns+`}]}}`)
      writeFile(t, filePath, source)
      resolver, err := LoadConfigResolver(&PluginEntry{}, root, "tsconfig.json")
      if err != nil {
        t.Fatalf("LoadConfigResolver: %v", err)
      }
      engine := NewEngineWithResolver(resolver)
      if err := engine.ConfigError(); err != nil {
        t.Fatalf("NewEngineWithResolver: %v", err)
      }
      if engine.EnabledRules()["unicorn/string-content"] != SeverityError {
        t.Fatal("JSON config did not enable string-content at error severity")
      }
      engine.SetCurrentDirectory(root)
      file := parseTSFile(t, filePath, source)
      findings := engine.Run([]*shimast.SourceFile{file}, nil)
      if len(findings) != 1 || findings[0].Rule != "unicorn/string-content" || findings[0].Severity != SeverityError {
        t.Fatalf("want one string-content/error finding, got %+v", findings)
      }
      fixed, err := applyFindingFixes(root, findings)
      if err != nil {
        t.Fatalf("applyFindingFixes: %v", err)
      }
      if fixed != 1 {
        t.Fatalf("want one applied edit, got %d", fixed)
      }
      actual, err := os.ReadFile(filePath)
      if err != nil {
        t.Fatalf("ReadFile: %v", err)
      }
      if string(actual) != expected {
        t.Fatalf("ordered config output:\nwant %q\ngot  %q", expected, string(actual))
      }
    })
  }
}
