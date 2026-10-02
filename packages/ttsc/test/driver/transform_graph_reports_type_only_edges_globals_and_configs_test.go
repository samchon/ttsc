package driver_test

import (
  "crypto/sha256"
  "encoding/hex"
  "path/filepath"
  "slices"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestTransformGraphReportsTypeOnlyEdgesGlobalsAndConfigs Verifies
// driver.NewTransformGraph exposes the `tsc --incremental` reference bound:
// per-file direct resolved reference edges (type-only imports and
// `/// <reference>` targets included), files contributing to the global
// scope, and the tsconfig `extends` chain.
//
// Implements samchon/ttsc#716: bundlers erase type-only imports from their
// module graphs and persistent caches replay stale generated code unless the
// compiler host itself reports the language-semantic input set of a
// transform. The graph must therefore carry exactly the edges tsgo's own
// incremental engine stores in `referencedMap`, keyed like the transform
// envelope's typescript map, with the embedded `bundled:///` standard library
// excluded (those files are not filesystem inputs).
//
//  1. Load a project whose index.ts reaches mytype.ts only through
//     `import type` and ref.d.ts only through `/// <reference path>`,
//     alongside an ambient declaration file and an extended tsconfig.
//  2. Compute the transform graph.
//  3. Assert both edges, the ambient global, the config chain, and the
//     negative twins: no self edges, no module files in globals, an explicit
//     empty node and compiler-time proof for a file without references, and no
//     bundled library anywhere.
//
// @evidence contracts/testing.md#behavioral-verification NewTransformGraph reports reference edges, leaf proofs, globals and config chain while excluding modules and bundled libraries.
// @evidence contracts/testing.md#independent-expectations Authored imports/config inheritance and independent standard SHA-256 ground graph and hash expectations.
// @evidence contracts/testing.md#distinguishing-cases Type-only, triple-slash, ambient/module, empty leaf and bundled exclusion differ; realpath is only checked as absolute.
// @evidence contracts/testing.md#execution-ownership Go unit TestTransformGraphReportsTypeOnlyEdgesGlobalsAndConfigs is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestTransformGraphReportsTypeOnlyEdgesGlobalsAndConfigs(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.base.json", `{
  "compilerOptions": { "strict": true }
}
`)
  writeProjectFile(t, root, "tsconfig.json", `{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "module": "commonjs", "target": "es2020" },
  "files": ["index.ts", "mytype.ts", "ambient.d.ts", "ref.d.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `/// <reference path="./ref.d.ts" />
import type { MyType } from "./mytype";
export const value: MyType = { id: "x" };
`)
  mytypeText := "export interface MyType { id: string }\n"
  writeProjectFile(t, root, "mytype.ts", mytypeText)
  writeProjectFile(t, root, "ambient.d.ts", "declare const GLOBAL_FLAG: number;\n")
  writeProjectFile(t, root, "ref.d.ts", "declare interface Referenced { flag: boolean }\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    ForceNoEmit: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.Close()

  graph := driver.NewTransformGraph(prog, root)
  if graph == nil {
    t.Fatal("NewTransformGraph returned nil for a loaded program")
  }

  edges := graph.Edges["index.ts"]
  if !slices.Contains(edges, "mytype.ts") {
    t.Fatalf("type-only import edge missing: index.ts -> mytype.ts not in %v", edges)
  }
  if !slices.Contains(edges, "ref.d.ts") {
    t.Fatalf("triple-slash reference edge missing: index.ts -> ref.d.ts not in %v", edges)
  }
  if slices.Contains(edges, "index.ts") {
    t.Fatalf("self edge must be dropped: %v", edges)
  }

  // A file that references nothing remains an explicit leaf node. Its
  // compiler-time proof closes the A-B-A window that project snapshots alone
  // cannot detect.
  entry, ok := graph.Edges["mytype.ts"]
  if !ok || len(entry) != 0 {
    t.Fatalf("mytype.ts leaf adjacency = %v, %v; want present and empty", entry, ok)
  }
  digest := sha256.Sum256([]byte(mytypeText))
  if hash := graph.InputHashes["mytype.ts"]; hash == nil || *hash != hex.EncodeToString(digest[:]) {
    t.Fatalf("mytype.ts compiler-time hash = %#v, want %s", hash, hex.EncodeToString(digest[:]))
  }
  if realpath := graph.InputRealpaths["mytype.ts"]; realpath == nil || !filepath.IsAbs(*realpath) {
    t.Fatalf("mytype.ts compiler-time realpath = %#v, want absolute", realpath)
  }

  if !slices.Contains(graph.Globals, "ambient.d.ts") {
    t.Fatalf("ambient declaration file missing from globals: %v", graph.Globals)
  }
  // ref.d.ts is ambient too; both module files must stay out of globals.
  for _, module := range []string{"index.ts", "mytype.ts"} {
    if slices.Contains(graph.Globals, module) {
      t.Fatalf("module file %q must not contribute to the global scope: %v", module, graph.Globals)
    }
  }

  wantConfigs := []string{
    "tsconfig.json",
    filepath.ToSlash(filepath.Join(root, "tsconfig.base.json")),
  }
  // ExtendedSourceFiles yields absolute paths; TransformOutputKey relativizes
  // in-project ones, so both entries should come back project-relative.
  normalizedConfigs := make([]string, 0, len(graph.Configs))
  for _, config := range graph.Configs {
    if filepath.IsAbs(filepath.FromSlash(config)) {
      rel, err := filepath.Rel(root, filepath.FromSlash(config))
      if err == nil {
        config = filepath.ToSlash(rel)
      }
    }
    normalizedConfigs = append(normalizedConfigs, config)
  }
  if !slices.Equal(normalizedConfigs, []string{"tsconfig.json", "tsconfig.base.json"}) {
    t.Fatalf("config chain mismatch: got %v (raw %v), want tsconfig.json then tsconfig.base.json (want-raw %v)", normalizedConfigs, graph.Configs, wantConfigs)
  }

  // The embedded standard library is not a filesystem input; it must never
  // appear as an edge source, an edge target, or a global.
  assertNoBundledEntries(t, graph)
}

// assertNoBundledEntries fails the test when any graph section mentions a
// bundled:/// standard-library path.
func assertNoBundledEntries(t *testing.T, graph *driver.TransformGraph) {
  t.Helper()
  for source, targets := range graph.Edges {
    if strings.HasPrefix(source, "bundled:") {
      t.Fatalf("bundled library appears as an edge source: %q", source)
    }
    for _, target := range targets {
      if strings.HasPrefix(target, "bundled:") {
        t.Fatalf("bundled library appears as an edge target: %q -> %q", source, target)
      }
    }
  }
  for _, global := range graph.Globals {
    if strings.HasPrefix(global, "bundled:") {
      t.Fatalf("bundled library appears in globals: %q", global)
    }
  }
}
