package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDocTagsStopAtTheExternalBoundary verifies that a documentation tag written
// in a dependency contributes nothing.
//
// The graph's boundary is the workspace: a dependency's declaration enters only
// as a named endpoint, never walked into. A tag read from one would put a
// citation the consumer did not write into their index — answering "which code
// implements this specification" with somebody else's code — and it would do so
// silently, because the address would look like any other. The collector reaches
// only declarations the build pass records, so this holds by construction; the
// test is here because "by construction" is what stops being true when the
// construction changes.
//
//  1. Build a fixture whose `node_modules` dependency carries a tag and whose
//     workspace source carries another.
//  2. Assert the workspace tag is recorded.
//  3. Assert no tag is recorded from the dependency, under any target.
func TestDocTagsStopAtTheExternalBoundary(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), nodeModulesGlobalFixtureTSConfig)
  writeFile(t, filepath.Join(root, "node_modules", "dep", "globals.ts"), `/** @evidence docs/vendor.md#theirs Written by the dependency. */
export function vendored(): void {}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `/** @evidence docs/ours.md#mine Written here. */
export function ours(): void {}
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  tags := docTagsByTargetSuffix(Build(prog))

  assertDocTag(t, tags, "#ours:function", "evidence", "docs/ours.md#mine Written here.")

  for target, list := range tags {
    for _, tag := range list {
      if strings.Contains(target, "node_modules") ||
        strings.Contains(tag.Text, "docs/vendor.md") {
        t.Fatalf("recorded %s from %s; a dependency's citation is not this project's",
          tag.Text, target)
      }
    }
  }
}
