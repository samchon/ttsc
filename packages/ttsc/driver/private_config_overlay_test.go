package driver

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

// TestPrivateConfigOverlayKeepsOwnerTypeDiscovery verifies that a private wrapper selects the requested root and retains its owner's type packages.
//
// 1. Write a config with an excluded error and ambient packages beneath its directory.
// 2. Open a wrapper from separate storage through the native Program loader.
// 3. Check the selected root successfully and verify the virtual config never exists on disk.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram parses and checks actual TypeScript with its own VFS and ambient lookup.
// @evidence contracts/testing.md#independent-expectations A deliberate error in the owner's normal root must not appear, and the requested root compiles only if the ambient name is found.
// @evidence contracts/testing.md#distinguishing-cases Both implicit node_modules discovery and explicit typeRoots work, with the same separate wrapper storage and no visible wrapper file.
// @evidence contracts/testing.md#execution-ownership The Go driver runs the real Program on directories managed by the test.
func TestPrivateConfigOverlayKeepsOwnerTypeDiscovery(t *testing.T) {
	for _, tc := range []struct{ name, options, packageDir string }{
		{"implicit", `"strict":true,"types":["*"]`, "node_modules/@types"},
		{"explicit", `"strict":true,"types":["fixture"],"typeRoots":["./ambient"]`, "ambient"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root, store := t.TempDir(), t.TempDir()
			owner := filepath.Join(root, "tsconfig.json")
			overlay := filepath.Join(store, ".ttsx-root.tsconfig.json")
			source := filepath.Join(root, "entry.ts")
			files := map[string]string{
				owner:                            fmt.Sprintf(`{"compilerOptions":{%s},"files":["normal.ts"]}`, tc.options),
				source:                           `export const entry: string = ambientValue;`,
				filepath.Join(root, "normal.ts"): `const failure: string = 0;`,
				filepath.Join(root, filepath.FromSlash(tc.packageDir), "fixture", "index.d.ts"): `declare const ambientValue: string;`,
				overlay: fmt.Sprintf(`{"extends":%q,"files":[%q],"include":[],"exclude":[]}`, filepath.ToSlash(owner), filepath.ToSlash(source)),
			}
			for name, text := range files {
				if err := os.MkdirAll(filepath.Dir(name), 0o755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(name, []byte(text), 0o644); err != nil {
					t.Fatal(err)
				}
			}
			payload, err := json.Marshal([2]string{overlay, owner})
			if err != nil {
				t.Fatal(err)
			}
			t.Setenv("TTSC_PRIVATE_CONFIG_OVERLAY", string(payload))
			program, diagnostics, err := LoadProgram(root, overlay, LoadProgramOptions{ForceNoEmit: true})
			if err != nil || program == nil || len(diagnostics) != 0 {
				t.Fatalf("load the private config: %v, %+v", err, diagnostics)
			}
			defer program.Close()
			if got := program.Diagnostics(); len(got) != 0 {
				t.Fatalf("private config diagnostics: %+v", got)
			}
			if _, err := os.Lstat(filepath.Join(root, filepath.Base(overlay))); !os.IsNotExist(err) {
				t.Fatalf("virtual config has a disk entry: %v", err)
			}
		})
	}
}
