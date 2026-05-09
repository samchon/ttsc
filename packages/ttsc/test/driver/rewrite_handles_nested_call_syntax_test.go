package ttsc_test

import (
	"path/filepath"
	"strings"
	"testing"

	shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteHandlesNestedCallSyntax verifies emit-time call matching
// skips strings, template literals, comments, and regex literals inside args.
//
// 1. Compile a plugin call with nested syntax in its argument list.
// 2. Register a namespace-aware rewrite for that call.
// 3. Assert the replacement succeeds without being confused by inner tokens.
func TestDriverRewriteHandlesNestedCallSyntax(t *testing.T) {
	root := t.TempDir()

	// Scenario setup: the call argument contains token shapes that would break a
	// naive parenthesis scanner.
	writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
	writeProjectFile(t, root, "index.ts", "declare const plugin: { ns: { make(...args: unknown[]): string } };\n"+
		"export const value = plugin.ns.make(\n"+
		"  `template ${\"value\"}`,\n"+
		"  (/a\\)b/.test(\"a)b\")),\n"+
		"  \"quoted )\",\n"+
		"  // line comment with )\n"+
		"  /* block comment with ) */ 1\n"+
		");\n")
	prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(diags) != 0 {
		t.Fatalf("unexpected config diagnostics: %#v", diags)
	}
	defer prog.Close()
	rewrites := driver.NewRewriteSet()
	rewrites.Add(driver.Rewrite{
		File:          prog.SourceFiles()[0],
		RootName:      "plugin",
		Namespaces:    []string{"ns"},
		Method:        "make",
		Replacement:   `"nested"`,
		ConsumeParens: true,
	})

	// Emit assertion: the complex argument list should still be consumed as one
	// call expression and replaced with the generated fragment.
	emitted := map[string]string{}
	_, emitDiags, err := prog.EmitAll(rewrites, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
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
	if !strings.Contains(js, `"nested"`) || strings.Contains(js, "plugin.ns.make") {
		t.Fatalf("nested call rewrite failed:\n%s", js)
	}
}
