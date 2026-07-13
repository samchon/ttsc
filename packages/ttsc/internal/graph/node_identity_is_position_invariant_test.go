package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestNodeIdentityIsPositionInvariant verifies that a declaration keeps the same
// node id after lines are inserted above it. A byte-offset or line-number key
// would re-key every declaration below an edit, forcing a future incremental
// layer to churn the whole graph; the realpath + name + kind key does not.
//
// The probe rewrites the same file with a comment and blank lines prepended,
// shifting every offset below, and asserts (a) the reload actually changed the
// source text, so the result is not a stale cached read, and (b) the node-id set
// is identical across the shift.
//
//  1. Compile a fixture, capture its node ids and source text.
//  2. Rewrite the same file with leading lines that shift every offset.
//  3. Assert the text changed but the node-id set did not.
func TestNodeIdentityIsPositionInvariant(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  main := filepath.Join(root, "src", "main.ts")

  writeFile(t, main, `export function fn(): void {}
export const value = 1;
`)
  firstIDs, firstText := buildSnapshot(t, root)

  writeFile(t, main, `// a leading comment that shifts every offset below it

export function fn(): void {}

export const value = 1;
`)
  secondIDs, secondText := buildSnapshot(t, root)

  if firstText == secondText {
    t.Fatal("the reload returned identical source text; the probe is reading a stale cache, not the shifted file")
  }
  // fn, value, and the module node for main.ts, whose id is the file path and so
  // is position-invariant like the rest.
  if len(firstIDs) != 3 {
    t.Fatalf("expected 3 nodes, got %d: %v", len(firstIDs), firstIDs)
  }
  if !equalStringSets(firstIDs, secondIDs) {
    t.Fatalf("node identity changed when positions shifted:\n first=%v\n second=%v", firstIDs, secondIDs)
  }
}

// buildSnapshot compiles root, then returns the built graph's node-id set and
// the source text of main.ts so the caller can confirm a reload took effect.
func buildSnapshot(t *testing.T, root string) (map[string]bool, string) {
  t.Helper()
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  text := sourceFile(t, prog, "main.ts").Text()
  ids := map[string]bool{}
  for id := range Build(prog).Nodes {
    ids[id] = true
  }
  return ids, text
}

// equalStringSets reports whether a and b hold the same keys.
func equalStringSets(a, b map[string]bool) bool {
  if len(a) != len(b) {
    return false
  }
  for key := range a {
    if !b[key] {
      return false
    }
  }
  return true
}
