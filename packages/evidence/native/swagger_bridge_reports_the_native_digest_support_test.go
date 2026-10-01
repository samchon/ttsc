package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

// swaggerBridgeRoot materializes a project the real Node bridge can load from.
//
// The temporary project is owned by this Go package. Node package self-reference
// resolves the enclosing @ttsc/evidence manifest and its built loader; fixture
// preparation never installs a consumer or compiles the loader.
func swaggerBridgeRoot(t *testing.T, document string) string {
  t.Helper()
  suite := "."
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
