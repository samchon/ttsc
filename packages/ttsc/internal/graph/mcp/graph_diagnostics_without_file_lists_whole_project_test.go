package mcp_test

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
	"github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestGraphDiagnosticsWithoutFileListsWholeProject verifies that calling
// query_diagnostics with no file returns every current diagnostic across the
// project, grouped by file, instead of requiring one path.
//
// This is the post-edit "what is broken now" check: after a change an agent
// wants the whole project's errors in one call, not a file at a time. The guard
// pins that a blank/absent file fans out to all files (not just the first) and
// keeps each finding's tsc code, so the listing is actionable.
//
//  1. Build the server from a two-file fixture where both files have a type error.
//  2. Call query_diagnostics with empty arguments (no file).
//  3. Assert the result names both files, both TS2322 codes, and the count header.
func TestGraphDiagnosticsWithoutFileListsWholeProject(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/a.ts", "src/b.ts"]
}
`)
	writeFile(t, filepath.Join(root, "src", "a.ts"), "export const a: number = \"no\";\n")
	writeFile(t, filepath.Join(root, "src", "b.ts"), "export const b: string = 123;\n")

	prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = prog.Close() }()
	server := mcp.NewServer(prog)

	text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_diagnostics","arguments":{}}}`)

	for _, want := range []string{"a.ts", "b.ts", "TS2322", "across 2 file"} {
		if !strings.Contains(text, want) {
			t.Fatalf("whole-project diagnostics missing %q:\n%s", want, text)
		}
	}
}
