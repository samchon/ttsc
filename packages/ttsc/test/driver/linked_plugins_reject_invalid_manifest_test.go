package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLinkedPluginsRejectInvalidManifest Verifies that LoadProgram rejects malformed linked manifest JSON with an error naming its environment variable.
//
// Malformed manifest rejection is asserted, without requiring nil Program or exact parser wording.
//
// 1. Set TTSC_LINKED_PLUGINS_JSON to malformed JSON.
// 2. Load a real tsconfig project.
// 3. Assert the returned error names the invalid manifest variable.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram rejects malformed linked manifest JSON with an error naming its environment variable.
// @evidence contracts/testing.md#independent-expectations A lone opening brace is invalid JSON independently of manifest loading.
// @evidence contracts/testing.md#distinguishing-cases Malformed manifest rejection is asserted, without requiring nil Program or exact parser wording.
// @evidence contracts/testing.md#execution-ownership The registry is reset and t.Setenv restores the manifest after direct Go loading. Go discovers TestDriverLinkedPluginsRejectInvalidManifest under ./test/driver.
func TestDriverLinkedPluginsRejectInvalidManifest(t *testing.T) {
  resetLinkedPluginRegistry()
  t.Setenv(driver.LinkedPluginsEnv, `{`)
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if prog != nil {
    _ = prog.Close()
  }
  if err == nil || !strings.Contains(err.Error(), driver.LinkedPluginsEnv) {
    t.Fatalf("expected invalid linked manifest error, got %v", err)
  }
}
