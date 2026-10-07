package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

// prismaBridgeRoot materializes a project the real Node bridge can load from.
//
// The temporary project is owned by this Go package. Node package self-reference
// resolves the enclosing @ttsc/evidence manifest and its built loader; fixture
// preparation never installs a consumer or compiles the loader.
func prismaBridgeRoot(t *testing.T, files map[string]string) string {
  t.Helper()
  suite := "."
  if _, err := os.Stat(filepath.Join("..", "lib", "internal", "loadPrismaModels.js")); err != nil {
    t.Fatalf("the bridge loader must be compiled before it can be exercised; run `pnpm build`: %v", err)
  }
  created, err := os.MkdirTemp(suite, "prisma-bridge-")
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
  for relative, content := range files {
    absolute := filepath.Join(root, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  return root
}

func mustGlobSet(t *testing.T, patterns []string) globSet {
  t.Helper()
  globs, err := newGlobSet(patterns)
  if err != nil {
    t.Fatal(err)
  }
  return globs
}

const prismaBridgeSchema = `datasource db {
  provider = "postgresql"
}

/// A sale.
model Sale {
  id        String @id @db.Uuid
  price     Int
  seller_id String @db.Uuid
  seller    Seller @relation(fields: [seller_id], references: [id])
}

model Seller {
  id    String @id @db.Uuid
  sales Sale[]
}
`
