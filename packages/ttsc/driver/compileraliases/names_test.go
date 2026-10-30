package compileraliases

import (
  "os"
  "path/filepath"
  "reflect"
  "testing"
)

// TestNamesUsesTheNearestCompilerDeclaration verifies npm alias discovery from
// declarations rather than a reserved exposed name.
//
// 1. Declare arbitrary aliases across all supported dependency maps.
// 2. Discover them from a nested file, excluding a different npm target.
// 3. Give the nested package its own compiler declaration and require isolation.
//
// @evidence contracts/testing.md#behavioral-verification Calls Names over authored manifests and compares the candidate names it returns; an npm target lookalike must be excluded and a workspace's own compiler declaration must stop ancestor alias discovery.
// @evidence contracts/testing.md#independent-expectations The aliases alpha, middle and zeta target typescript by literal npm syntax; the contract sorts them before the ordinary typescript fallback. A local typescript declaration independently prescribes the singleton fallback.
// @evidence contracts/testing.md#distinguishing-cases Exercises dependencies, devDependencies and optionalDependencies, an unrelated target, nested discovery, local declaration isolation, malformed metadata failure and an absent local manifest after removal.
// @evidence contracts/testing.md#execution-ownership This directly discovered Go unit calls Names in-process over t.TempDir inputs. It resolves no installed compiler and starts no process.
func TestNamesUsesTheNearestCompilerDeclaration(t *testing.T) {
  root := t.TempDir()
  nested := filepath.Join(root, "workspace")
  if err := os.MkdirAll(nested, 0o755); err != nil {
    t.Fatal(err)
  }
  write := func(file, body string) {
    t.Helper()
    if err := os.WriteFile(file, []byte(body), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  write(filepath.Join(root, "package.json"), `{"dependencies":{"zeta":"npm:typescript@7","unrelated":"npm:typescript-helper@7"},"devDependencies":{"alpha":"npm:typescript@next"},"optionalDependencies":{"middle":"npm:typescript"}}`)
  anchor := filepath.Join(nested, "lint.config.ts")
  got, err := Names(anchor)
  want := []string{"alpha", "middle", "zeta", "typescript"}
  if err != nil || !reflect.DeepEqual(got, want) {
    t.Fatalf("Names = %v, %v; want %v", got, err, want)
  }
  manifest := filepath.Join(nested, "package.json")
  write(manifest, `{"devDependencies":{"typescript":"7.0.2"}}`)
  got, err = Names(anchor)
  if err != nil || !reflect.DeepEqual(got, []string{"typescript"}) {
    t.Fatalf("local Names = %v, %v; want [typescript]", got, err)
  }
  write(manifest, "{")
  if _, err := Names(anchor); err == nil {
    t.Fatal("malformed manifest must fail discovery")
  }
  if err := os.Remove(manifest); err != nil {
    t.Fatal(err)
  }
  got, err = Names(anchor)
  if err != nil || !reflect.DeepEqual(got, want) {
    t.Fatalf("restored Names = %v, %v; want %v", got, err, want)
  }
}
