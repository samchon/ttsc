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
// @evidence contracts/testing.md#behavioral-verification Transform must retain the script declaration module @lib/ambient and never insert ./lib/ambient.js; writing returned text back and native check with plugins-json=[] must succeed silently.
// @evidence contracts/testing.md#independent-expectations TypeScript forbids relative global ambient module names. The independent plugin-free compiler check catches the TS2436 consequence beyond a substring assertion.
// @evidence contracts/testing.md#distinguishing-cases A global script declaration must remain unchanged, unlike the external-module augmentation in the supported-forms entry. The second check disables the plugin so it cannot undo its own bad output.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandPreservesGlobalAmbientModule entry runs in the paths E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary Native transform output is fed into a separate real compiler validation. Direct visitor tests cannot establish acceptance of the serialized, published source by the compiler.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts two processes (transform with the paths manifest, then check with --plugins-json=[]) from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity seedPathsProject (shared.SeedProject) writes the fixture project under t.TempDir, which the test framework removes at cleanup; the body overwrites src/global.ts with the transformed text between the transform and check processes, and each process exits before the next starts, so the check sees exactly the written text. TestMain removes only the fallback producer directory after m.Run. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The transform status/stderr check (L37), JSON decode (L41), ambient-name retention checks (L45) and the plugin-free check status/streams (L51) are all made in this body; nothing is delegated elsewhere.
func TestCommandPreservesGlobalAmbientModule(t *testing.T) {
  root := shared.SeedProject(t, map[string]string{
    "tsconfig.json":      `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"paths":{"@lib/*":["./src/lib/*"]},"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/global.ts":      `declare module "@lib/ambient" { export const value: "global"; }` + "\n",
    "src/lib/ambient.ts": `export const value = "global";` + "\n",
  })

  code, stdout, stderr := runPlugin(t, "transform", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t))
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
  code, stdout, stderr = runPlugin(t, "check", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json=[]", "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("transformed global ambient module did not type-check: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
