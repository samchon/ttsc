package main

import (
	"os"
	"path/filepath"
	"testing"
)

// TestServeSessionReloadsNewlyResolvedPackageImport verifies wildcard imports
// targets are tracked with the wildcard text matched from the package key.
func TestServeSessionReloadsNewlyResolvedPackageImport(t *testing.T) {
	root := t.TempDir()
	writeGraphFile(t, filepath.Join(root, "package.json"), `{
  "name": "fixture-project",
  "imports": { "#generated/*": "./generated/*.js" }
}`)
	writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "nodenext", "moduleResolution": "nodenext" },
  "files": ["src/index.ts"]
}`)
	writeGraphFile(t, filepath.Join(root, "src", "index.ts"), "import { generated } from '#generated/value';\nexport function main(): void { generated(); }\n")

	session, err := newGraphSession(root, "tsconfig.json")
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	if _, _, _, err := session.Snapshot(); err != nil {
		t.Fatal(err)
	}

	target := filepath.Join(root, "generated", "value.ts")
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(target, []byte("export function generated(): void {}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	dump, mode, changed, err := session.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	if dump == nil || mode != "reload" || !changed {
		t.Fatalf("new package imports target = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
	}
}
