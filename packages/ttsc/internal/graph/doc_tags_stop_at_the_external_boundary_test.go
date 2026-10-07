package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDocTagsStopAtTheExternalBoundary verifies that a documentation tag written
// in the explicitly loaded node_modules fixture contributes no collected tag,
// while the workspace citation remains present.
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
//
// @evidence contracts/testing.md#behavioral-verification The explicitly loaded raw dependency source is resident, but Build returns the literal workspace citation and no collected tag whose target names node_modules or whose text names docs/vendor.md.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over a workspace source with one tag and a node_modules dependency with another: the workspace tag must be recorded on its declaration, and no recorded tag may have a target containing node_modules or text naming docs/vendor.md.
// @evidence contracts/testing.md#distinguishing-cases Build a fixture whose `node_modules` dependency carries a tag and whose workspace source carries another; Assert the workspace tag is recorded; Assert no tag is recorded from the dependency, under any target.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes its native workspace/dependency fixture, constructs and closes a driver compiler Program in-process, and calls Build. A restored empty linked-plugin manifest excludes ambient hooks; no installed consumer or native product command runs. The dependency is an explicit compiler input, not an installed package lookup.
func TestDocTagsStopAtTheExternalBoundary(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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

  // Exclusion must not pass merely because the dependency was never loaded.
  sourceFile(t, prog, "node_modules/dep/globals.ts")

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
