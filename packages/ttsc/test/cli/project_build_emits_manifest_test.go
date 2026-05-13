package ttsc_test

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCLIProjectBuildEmitsManifest verifies the native build command writes
// JavaScript and the optional emitted-file manifest together.
//
// The manifest path is only meaningful when the build reaches the emit callback.
// This scenario keeps the JavaScript output, verbose stream, and manifest JSON
// tied to the same real project build.
//
// 1. Create a small project with `outDir`.
// 2. Run the real CLI through the build front door.
// 3. Assert emitted JavaScript, verbose output, and manifest contents.
func TestCLIProjectBuildEmitsManifest(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: the manifest only has meaning when the compiler writes a
  // real output file, so the fixture uses `--emit` with a configured outDir.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)
  manifest := filepath.Join(root, "manifest.json")

  // Build assertion: verbose output names the emitted count while the manifest
  // remains a machine-readable file list for wrapper callers.
  code, out, errOut := runNativeCommand(t, "build", "--cwd", root, "--emit", "--verbose", "--manifest", manifest)
  if code != 0 {
    t.Fatalf("build failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if !strings.Contains(out, "emitted=") {
    t.Fatalf("verbose build output missing emitted count: %q", out)
  }
  if _, err := os.Stat(filepath.Join(root, "bin", "index.js")); err != nil {
    t.Fatalf("expected emitted JavaScript: %v", err)
  }

  raw, err := os.ReadFile(manifest)
  if err != nil {
    t.Fatal(err)
  }
  var files []string
  if err := json.Unmarshal(raw, &files); err != nil {
    t.Fatalf("manifest JSON decode failed: %v\n%s", err, raw)
  }
  if len(files) == 0 || !strings.HasSuffix(filepath.ToSlash(files[0]), "bin/index.js") {
    t.Fatalf("manifest did not include emitted JavaScript: %#v", files)
  }
}
