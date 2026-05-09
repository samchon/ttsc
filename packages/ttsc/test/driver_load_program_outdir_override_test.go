package ttsc_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLoadProgramOutDirOverride verifies LoadProgramOptions.OutDir
// controls raw emit output even when tsconfig does not specify outDir.
//
// 1. Load a real project with ForceEmit and an OutDir override.
// 2. Emit through the default writer.
// 3. Assert JavaScript appears under the requested output directory.
func TestDriverLoadProgramOutDirOverride(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: tsconfig intentionally omits outDir so the only output
	// location should come from LoadProgramOptions.OutDir.
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

	// Emit assertion: nil WriteFile selects driver.DefaultWriteFile, so this also
	// covers the command-side default disk writer path.
	prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
		ForceEmit: true,
		OutDir:    "custom",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(diags) != 0 {
		t.Fatalf("unexpected config diagnostics: %#v", diags)
	}
	defer prog.Close()
	if _, emitDiags, err := prog.EmitAllRaw(nil); err != nil || len(emitDiags) != 0 {
		t.Fatalf("EmitAllRaw mismatch: err=%v diagnostics=%#v", err, emitDiags)
	}
	js, err := os.ReadFile(filepath.Join(root, "custom", "index.js"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(js), "exports.value") {
		t.Fatalf("override output missing JavaScript body:\n%s", js)
	}
}
