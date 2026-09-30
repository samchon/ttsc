package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

// swaggerBridgeRoot materializes a project the real Node bridge can load from.
//
// The directory lives under `tests/test-evidence` rather than in the system
// temp area, because the bridge resolves `@ttsc/evidence` by
// name from the root it is handed. That name resolves in exactly one place in
// this workspace — the feature suite's `node_modules`, which pnpm links to this
// package — and a directory outside the workspace cannot see it at all.
func swaggerBridgeRoot(t *testing.T, document string) string {
  t.Helper()
  suite := filepath.Join("..", "..", "..", "tests", "test-evidence")
  if _, err := os.Stat(filepath.Join(suite, "node_modules", "@ttsc", "evidence")); err != nil {
    t.Fatalf("the feature suite must link this package before the bridge can be exercised; run `pnpm install`: %v", err)
  }
  if _, err := os.Stat(filepath.Join("..", "lib", "internal", "loadSwaggerOperations.js")); err != nil {
    t.Fatalf("the bridge normalizer must be compiled before it can be exercised; run `pnpm build`: %v", err)
  }
  created, err := os.MkdirTemp(suite, "swagger-bridge-")
  if err != nil {
    t.Fatal(err)
  }
  t.Cleanup(func() { _ = os.RemoveAll(created) })
  // Absolute, because the bridge builds a `createRequire` base from this and
  // Node rejects a relative one. Every production caller resolves the project
  // root through `filepath.Abs` for the same reason.
  root, err := filepath.Abs(created)
  if err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(root, "swagger.json"), []byte(document), 0o644); err != nil {
    t.Fatal(err)
  }
  return root
}
