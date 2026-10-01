package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

// prismaBridgeRoot materializes a project the real Node bridge can load from.
//
// The directory lives under `tests/test-evidence-e2e` rather than in the system
// temp area, because the bridge resolves `@ttsc/evidence` by
// name from the root it is handed. That name resolves in exactly one place in
// this workspace — the feature suite's `node_modules`, which pnpm links to this
// package — and a directory outside the workspace cannot see it at all.
//
// Nothing here installs a Prisma parser into that root, and that is deliberate:
// it is the layout every real consumer has, because neither `prisma` nor
// `@prisma/client` depends on one. These cases therefore exercise the fallback
// to the plugin's own pinned parser, which is the path almost every build takes.
func prismaBridgeRoot(t *testing.T, files map[string]string) string {
  t.Helper()
  suite := filepath.Join("..", "..", "..", "tests", "test-evidence-e2e")
  if _, err := os.Stat(filepath.Join(suite, "node_modules", "@ttsc", "evidence")); err != nil {
    t.Fatalf("the feature suite must link this package before the bridge can be exercised; run `pnpm install`: %v", err)
  }
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
