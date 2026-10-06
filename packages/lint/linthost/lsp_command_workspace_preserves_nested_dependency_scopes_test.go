package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPCommandWorkspacePreservesNestedDependencyScopes verifies staging keeps
// each package's actual module and ambient-type authority without copying its
// dependencies or allowing command cleanup to remove the original modules.
//
// @evidence contracts/testing.md#behavioral-verification Calls prepareLSPCommandWorkspace on real root and nested dependency directories, reads each staged package and Node-global declaration, then cleans the staged tree and reads the originals again.
// @evidence contracts/testing.md#independent-expectations Root/one/two literal module and ambient declaration bytes independently distinguish each dependency scope and cleanup ownership.
// @evidence contracts/testing.md#distinguishing-cases Root and two nested packages provide the same module names with different values; flattening to the root dependency link gives the wrong nested values. Ordinary nested directories and an actual directory alias exercise both staging traversals where directory links are available.
// @evidence contracts/testing.md#execution-ownership The test calls the real filesystem staging helper in process and owns its temporary tree; it starts no compiler, editor, Node process or sidecar and does not certify configuration evaluation.
func TestLSPCommandWorkspacePreservesNestedDependencyScopes(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{"files":["src/main.ts"]}`)
  target := filepath.Join(root, "src/main.ts")
  writeFile(t, target, "export const value = 1;\n")
  scopes := []string{"", "packages/one", "packages/two"}
  for _, scope := range scopes {
    label := scope
    if label == "" { label = "root" }
    writeFile(t, filepath.Join(root, scope, "node_modules/same/index.js"), label)
    writeFile(t, filepath.Join(root, scope, "node_modules/@types/node/index.d.ts"), "// " + label + "\ndeclare const __dirname: string;\n")
  }
  alias := filepath.Join(root, "alias-one")
  aliasAvailable := os.Symlink(filepath.Join(root, "packages/one"), alias) == nil
  staged, _, _, cleanup, err := prepareLSPCommandWorkspace(root, filepath.Join(root, "tsconfig.json"), target)
  if err != nil { t.Fatal(err) }
  t.Cleanup(cleanup)
  for _, scope := range scopes {
    label := scope
    if label == "" { label = "root" }
    assertFileText(t, filepath.Join(staged, scope, "node_modules/same/index.js"), label)
    assertFileText(t, filepath.Join(staged, scope, "node_modules/@types/node/index.d.ts"), "// " + label + "\ndeclare const __dirname: string;\n")
    if resolveDirLink(filepath.Join(staged, scope, "node_modules")) != resolveDirLink(filepath.Join(root, scope, "node_modules")) {
      t.Fatalf("dependency scope was copied or replaced: %s", scope)
    }
  }
  if aliasAvailable {
    assertFileText(t, filepath.Join(staged, "alias-one/node_modules/same/index.js"), "packages/one")
  }
  cleanup()
  if _, err := os.Stat(staged); !os.IsNotExist(err) { t.Fatalf("staged workspace remains after cleanup: %v", err) }
  for _, scope := range scopes {
    label := scope
    if label == "" { label = "root" }
    assertFileText(t, filepath.Join(root, scope, "node_modules/same/index.js"), label)
    assertFileText(t, filepath.Join(root, scope, "node_modules/@types/node/index.d.ts"), "// " + label + "\ndeclare const __dirname: string;\n")
  }
}
