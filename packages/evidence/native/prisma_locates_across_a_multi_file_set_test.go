package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a set spanning files locates each model in the file that declares
 * it.
 *
 * A schema folder is one namespace built from several files, and the parser
 * returns no file for anything it parses. Attributing a model to the wrong file
 * of the set would send an author to open a file their model is not in, and
 * would do it on exactly the layout Prisma's multi-file schemas encourage.
 *
 *  1. Write one model per file into a two-file set.
 *  2. Locate across the set.
 *  3. Assert each name reports its own file.
 *
 * @evidence contracts/testing.md#behavioral-verification locatePrismaDeclarations places Sale/Seller in their own files at line1.
 * @evidence contracts/testing.md#independent-expectations Two authored files and literal path-line assertions fix attribution.
 * @evidence contracts/testing.md#distinguishing-cases A set-wide scan must preserve each defining file.
 * @evidence contracts/testing.md#execution-ownership TestPrismaLocatesAcrossAMultiFileSet is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaLocatesAcrossAMultiFileSet(t *testing.T) {
  root := t.TempDir()
  write := func(relative string, content string) {
    absolute := filepath.Join(root, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  write("prisma/sale.prisma", "model Sale {\n  id String @id\n}\n")
  write("prisma/seller.prisma", "model Seller {\n  id String @id\n}\n")
  locations, _ := locatePrismaDeclarations(root, []string{
    "prisma/sale.prisma",
    "prisma/seller.prisma",
  })
  if locations["Sale"].Path != "prisma/sale.prisma" || locations["Sale"].Line != 1 {
    t.Fatalf("Sale located at %+v", locations["Sale"])
  }
  if locations["Seller"].Path != "prisma/seller.prisma" || locations["Seller"].Line != 1 {
    t.Fatalf("Seller located at %+v", locations["Seller"])
  }
}
