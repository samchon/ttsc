package ttsc_test

import (
	"bytes"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverDiagnosticShapes verifies public diagnostic helpers that plugins
// use to integrate with the native checker pipeline.
//
// 1. Load a source file so lint diagnostics can be anchored to real text.
// 2. Shape warning and error diagnostics through the public constructor.
// 3. Assert counting and plain fallback rendering contracts.
func TestDriverDiagnosticShapes(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: lint diagnostics need a real SourceFile to compute line and
	// column offsets consistently with TypeScript-Go.
	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020"
  },
  "files": ["index.ts"]
}
`)
	writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
	prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(diags) != 0 {
		t.Fatalf("unexpected diagnostics: %#v", diags)
	}
	defer prog.Close()
	source := prog.SourceFiles()[0]

	// Diagnostic assertion: zero-length lint ranges are widened by the renderer
	// shim and reflected in the public DTO length.
	warning := driver.NewLintDiagnostic(source, 0, 0, 1001, driver.SeverityWarning, "warning")
	failure := driver.NewLintDiagnostic(source, 0, 5, 1002, driver.SeverityError, "failure")
	if warning.Line != 1 || warning.Column != 1 || warning.Length == nil || *warning.Length != 1 {
		t.Fatalf("warning diagnostic location mismatch: %#v", warning)
	}
	if got := driver.CountErrors([]driver.Diagnostic{warning, failure, {Message: "plain"}}); got != 2 {
		t.Fatalf("error count mismatch: %d", got)
	}

	// Rendering assertion: diagnostics without raw anchors still get a stable
	// line-oriented fallback for callers that assemble plain messages.
	var out bytes.Buffer
	driver.WritePrettyDiagnostics(&out, []driver.Diagnostic{{File: "src/main.ts", Line: 2, Column: 4, Message: "plain"}}, root)
	if !strings.Contains(out.String(), "src/main.ts:2:4: plain") {
		t.Fatalf("plain diagnostic rendering mismatch:\n%s", out.String())
	}
}
