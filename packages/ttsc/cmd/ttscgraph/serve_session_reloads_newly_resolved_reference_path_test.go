package main

import (
	"os"
	"path/filepath"
	"testing"
)

// TestServeSessionReloadsNewlyResolvedReferencePath verifies triple-slash path
// directives participate in freshness even though they are not AST statements.
func TestServeSessionReloadsNewlyResolvedReferencePath(t *testing.T) {
	root := t.TempDir()
	writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs" },
  "files": ["src/index.ts"]
}`)
	writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "/// <reference path=\"../generated/types.d.ts\" />\nexport const value: Generated = { id: 1 };\n")

	session, err := newGraphSession(root, "tsconfig.json")
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	if _, _, _, err := session.Snapshot(); err != nil {
		t.Fatal(err)
	}

	target := filepath.Join(root, "generated", "types.d.ts")
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(target, []byte("interface Generated { id: number }\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	dump, mode, changed, err := session.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	if dump == nil || mode != "reload" || !changed {
		t.Fatalf("new reference path = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
	}
}
