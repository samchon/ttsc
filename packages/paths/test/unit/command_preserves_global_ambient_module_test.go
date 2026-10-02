package paths_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/paths/test/internal/shared"
)

// TestCommandPreservesGlobalAmbientModule verifies paths does not make a global ambient module relative.
//
// A string-named declaration is an augmentation only inside an external module.
// Rewriting the same declaration in a script creates TS2436, so this reaches the
// sidecar and re-checks its returned source rather than only inspecting text.
//
// 1. Transform a script that declares an aliased ambient module.
// 2. Assert the returned declaration keeps its non-relative name.
// 3. Check the transformed source without the plugin.
// @evidence contracts/testing.md#behavioral-verification Transform must retain the script declaration module @lib/ambient and never insert ./lib/ambient.js; writing returned text back and check with plugins-json=[] must succeed silently.
// @evidence contracts/testing.md#independent-expectations TypeScript forbids relative global ambient module names. The independent plugin-free compiler check catches the TS2436 consequence beyond a substring assertion.
// @evidence contracts/testing.md#distinguishing-cases A global script declaration must remain unchanged, unlike the external-module augmentation in the supported-forms entry. The second check disables the plugin so it cannot undo its own bad output.
// @evidence contracts/testing.md#execution-ownership The named entry is in test/unit and calls utility.RunCommandWithIO, the dispatch the standalone main delegates to, in this Go process with the paths plugin linked by the driver import and a t-owned fixture project; no built binary or child process is started.
func TestCommandPreservesGlobalAmbientModule(t *testing.T) {
  root := shared.SeedProject(t, map[string]string{
    "tsconfig.json":      `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"paths":{"@lib/*":["./src/lib/*"]},"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/global.ts":      `declare module "@lib/ambient" { export const value: "global"; }` + "\n",
    "src/lib/ambient.ts": `export const value = "global";` + "\n",
  })

  code, stdout, stderr := runCommand("transform", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t))
  if code != 0 || stderr != "" {
    t.Fatalf("transform branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var result transformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(stdout)), &result); err != nil {
    t.Fatalf("transform output is not JSON: %v\n%s", err, stdout)
  }
  global := result.TypeScript["src/global.ts"]
  if !strings.Contains(global, `declare module "@lib/ambient"`) || strings.Contains(global, `./lib/ambient.js`) {
    t.Fatalf("global ambient module was rewritten:\n%s", global)
  }

  writeFile(t, filepath.Join(root, "src", "global.ts"), global)
  code, stdout, stderr = runCommand("check", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json=[]", "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("transformed global ambient module did not type-check: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
