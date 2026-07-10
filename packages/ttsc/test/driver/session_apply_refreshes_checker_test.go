package driver_test

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverSessionApplyRefreshesChecker verifies incremental sessions replace
// the Checker lease together with the tsgo Program.
//
// UpdateProgram returns a new Program and checker pool even when it reuses all
// unchanged files. Keeping the wrapper's previous Checker would let consumers
// observe the new AST with stale types and diagnostics, which is especially
// dangerous for a checker-resolved graph.
//
// 1. Open a valid one-file resident Session.
// 2. Apply an import-stable edit that assigns a string to a number.
// 3. Assert the current Program reports the post-edit type error.
func TestDriverSessionApplyRefreshesChecker(t *testing.T) {
	root := t.TempDir()
	writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"strict":true,"noEmit":true},"files":["index.ts"]}`)
	file := filepath.Join(root, "index.ts")
	writeProjectFile(t, root, "index.ts", "export const value: number = 1;\n")

	session, diags, err := driver.NewSession(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true})
	if err != nil {
		t.Fatal(err)
	}
	if session == nil {
		t.Fatalf("NewSession returned nil (diagnostics: %v)", diags)
	}
	defer session.Close()

	if reused := session.Apply(file, "export const value: number = 'bad';\n"); !reused {
		t.Fatal("type-only body edit should reuse the resident program")
	}
	current := session.Program().Diagnostics()
	if !hasDiagnosticText(current, "not assignable to type 'number'") {
		t.Fatalf("updated checker did not report the post-edit type error: %v", current)
	}
}

func hasDiagnosticText(diags []driver.Diagnostic, text string) bool {
	for _, diag := range diags {
		if strings.Contains(diag.Message, text) {
			return true
		}
	}
	return false
}
