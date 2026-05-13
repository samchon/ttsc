package ttsc_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"
)

// TestCLIAPICompilePreservesOutsideOutputKey verifies API compile keeps
// absolute keys for emitted files outside the project cwd.
//
// Project-relative keys are the normal API result shape, but outputs outside
// cwd must not be collapsed into `..` paths. A tsconfig outDir above the project
// root exercises that path through the real compiler output callback.
//
// 1. Create a project whose outDir points outside the project directory.
// 2. Execute `api-compile` through the native command adapter.
// 3. Assert the emitted JavaScript key is absolute and names the outside outDir.
func TestCLIAPICompilePreservesOutsideOutputKey(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "../outside-bin"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  code, out, errOut := runNativeCommand(t, "api-compile", "--cwd", root)
  if code != 0 {
    t.Fatalf("api-compile failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  var compiled apiCompileResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(out)), &compiled); err != nil {
    t.Fatalf("api-compile JSON decode failed: %v\n%s", err, out)
  }

  foundOutsideKey := false
  for key := range compiled.Output {
    if filepath.IsAbs(filepath.FromSlash(key)) && strings.HasSuffix(key, "/outside-bin/index.js") {
      foundOutsideKey = true
      break
    }
  }
  if !foundOutsideKey {
    t.Fatalf("api-compile output did not preserve an absolute outside key: %#v", compiled.Output)
  }
}
