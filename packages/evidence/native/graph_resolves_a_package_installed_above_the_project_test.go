package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a nested Program resolves a package installed above it.
 *
 * `packages/backend/test` is its own ttsc project, but the package manager
 * installed into `packages/backend/node_modules` one level up. Looking only
 * beside the project root leaves that Program unable to read the manifest of a
 * package it imports, and a reference with no resolved entry addresses its
 * units through the module that matched instead of the specifier a citation can
 * spell.
 *
 *  1. Install the package one directory above the project root.
 *  2. Select it from the nested project.
 *  3. Assert the obligation carries the address the entry gives it.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRuleAtRoot exercises this case: Verifies a nested Program resolves a package installed above it. The original assertions check assert the obligation carries the address the entry gives it.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `packages/backend/test` is its own ttsc project, but the package manager installed into `packages/backend/node_modules` one level up. Looking only beside the project root leaves that Program unable to read the manifest of a package it imports, and a reference with no resolved entry addresses its units through the module that matched instead of the specifier a citation can spell. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Install the package one directory above the project root. Select it from the nested project. Assert the obligation carries the address the entry gives it. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphResolvesAPackageInstalledAboveTheProject is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRuleAtRoot within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphResolvesAPackageInstalledAboveTheProject(t *testing.T) {
  root := t.TempDir()
  project := filepath.Join(root, "test")
  if err := os.MkdirAll(project, 0o755); err != nil {
    t.Fatal(err)
  }
  for name, content := range map[string]string{
    "node_modules/@org/api/package.json": `{
  "name": "@org/api",
  "exports": { ".": "./src/index.ts" }
}`,
    "node_modules/@org/api/src/index.ts":  "export * as health from \"./health\";\n",
    "node_modules/@org/api/src/health.ts": "export function get(): void {}\n",
  } {
    absolute := filepath.Join(root, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  assertProblemContains(t, runIndexRuleAtRoot(t, project, map[string]string{
    "features/detail.ts": "export function detail(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["features/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","files":["src/**"],"symbol":"function"}
  }]}`), "Missing acknowledgement for 'health.get'")
}
