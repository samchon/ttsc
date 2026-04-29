// Helpers for the engine + config tests in this directory.
//
// The rule corpus is exercised end-to-end via tests/lint/cases.test.cjs;
// these Go tests stay focused on the lint engine's plumbing — dispatch,
// severity parsing, registry — using the lint package's public API.
package main

import (
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimcore "github.com/microsoft/typescript-go/shim/core"
	shimparser "github.com/microsoft/typescript-go/shim/parser"
)

// parseTS parses a TypeScript snippet under a virtual absolute file
// name (the parser refuses relative paths). Returns the SourceFile the
// engine will receive at runtime.
func parseTS(t *testing.T, source string) *shimast.SourceFile {
	t.Helper()
	opts := shimast.SourceFileParseOptions{
		FileName: "/virtual/test.ts",
	}
	file := shimparser.ParseSourceFile(opts, source, shimcore.ScriptKindTS)
	if file == nil {
		t.Fatalf("parser returned nil source file")
	}
	return file
}
