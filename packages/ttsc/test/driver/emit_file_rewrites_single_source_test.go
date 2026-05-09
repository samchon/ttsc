package ttsc_test

import (
	"path/filepath"
	"strings"
	"testing"

	shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitFileRewritesSingleSource verifies the one-file emit facade
// applies the same rewrite pipeline as whole-program emit.
//
// 1. Load a project with two source files.
// 2. Register a rewrite for the selected source only.
// 3. Emit that source through EmitFile and assert the patched output.
func TestDriverEmitFileRewritesSingleSource(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: the second source proves EmitFile can target one file while
	// still resolving the rewrite against the selected source path.
	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts", "other.ts"]
}
`)
	writeProjectFile(t, root, "index.ts", `declare const plugin: { make(): string };
export const value = plugin.make();
`)
	writeProjectFile(t, root, "other.ts", `export const other = 1;
`)

	// Program setup: target lookup uses the public SourceFile helper so the test
	// stays outside driver internals.
	prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(diags) != 0 {
		t.Fatalf("unexpected config diagnostics: %#v", diags)
	}
	defer prog.Close()
	target := prog.SourceFile(filepath.Join(root, "index.ts"))
	if target == nil {
		t.Fatal("SourceFile did not find index.ts")
	}
	rewrites := driver.NewRewriteSet()
	rewrites.Add(driver.Rewrite{
		File:          target,
		RootName:      "plugin",
		Method:        "make",
		Replacement:   `"single"`,
		ConsumeParens: true,
	})

	// Emit assertion: the callback observes only outputs produced for the
	// selected source file, and that output must carry the rewrite sentinel.
	emitted := map[string]string{}
	_, emitDiags, err := prog.EmitFile(rewrites, target, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
		emitted[filepath.Base(fileName)] = text
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(emitDiags) != 0 {
		t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
	}
	js := emitted["index.js"]
	if !strings.Contains(js, driver.RewriteSentinel) || !strings.Contains(js, `"single"`) {
		t.Fatalf("EmitFile output was not rewritten:\n%s", js)
	}
	if _, ok := emitted["other.js"]; ok {
		t.Fatalf("EmitFile emitted unrelated source output: %#v", emitted)
	}
}
