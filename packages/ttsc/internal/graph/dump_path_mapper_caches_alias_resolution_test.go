package graph

import "testing"

// TestDumpPathMapperCachesAliasResolution verifies repeated graph facts do not
// repeat filesystem canonicalization for the same raw source path.
//
// A large graph maps one source through its node, IDs and many edge endpoints;
// caching only after EvalSymlinks would turn those facts into repeated syscalls.
//
//  1. Install a counting canonicalizer on one mapper.
//  2. Map the same absolute source path repeatedly.
//  3. Require one canonicalization and one stable wire coordinate.
func TestDumpPathMapperCachesAliasResolution(t *testing.T) {
  mapper := newDumpPathMapper("C:/checkout/app")
  calls := 0
  mapper.canonicalize = func(path string) string {
    calls++
    return path
  }
  for range 100 {
    if wire := mapper.mapPath("C:/checkout/app/src/main.ts"); wire != "src/main.ts" {
      t.Fatalf("wire path = %q, want src/main.ts", wire)
    }
  }
  if calls != 1 {
    t.Fatalf("canonicalizer calls = %d, want 1", calls)
  }
}
