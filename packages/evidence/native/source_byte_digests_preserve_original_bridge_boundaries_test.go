package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies native byte hashing preserves the original bridge readability cases.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls prismaContentDigest over the original ordered bridge schema/Extra set, readable invalid-default schema and absent-schema request, and swaggerContentDigest over the original readable, unsupported-version and absent sources. Readable bytes yield nonempty keys regardless of semantic acceptance; absent inputs yield empty keys.
 * @evidence contracts/testing.md#independent-expectations The readable files are authored and the absent paths are never created. Byte identity exists before schema acceptance and does not exist for an unreadable request. These original native-side nonempty/empty expectations do not independently certify the hash framing or Node/native equality; the source-unit framing oracle and actual consumer interoperability own those stronger properties.
 * @evidence contracts/testing.md#distinguishing-cases Six named cases retain the original two-file Prisma request order, exact line-7 invalid-default bytes, unrelated readable Prisma neighbor beside an absent request, successful Swagger bytes, readable 4.0 rejection bytes and absent Swagger file. Digest framing, source edits and parsed operation meaning are covered by their owning source/native tests rather than inferred from nonempty keys.
 * @evidence contracts/testing.md#execution-ownership TestSourceByteDigestsPreserveOriginalBridgeBoundaries is one selectable Go entry with six synchronous named cases. Each owns a t.TempDir byte fixture and calls the native file/hash operation directly. It starts no parser, Node child, built artifact, installation or product host. Original bridge entries remain until actual source/transport survivors execute.
 */
func TestSourceByteDigestsPreserveOriginalBridgeBoundaries(t *testing.T) {
  for _, scenario := range []struct {
    name string
    files map[string]string
    prismaSources []string
    swaggerSource string
    nonempty bool
  }{
    {name: "prisma-readable-two-file-set", files: map[string]string{
      "prisma/schema.prisma": prismaBridgeSchema,
      "prisma/seller.prisma": "model Extra {\n  id String @id @db.Uuid\n}\n",
    }, prismaSources: []string{"prisma/schema.prisma", "prisma/seller.prisma"}, nonempty: true},
    {name: "prisma-readable-invalid-default", files: map[string]string{"prisma/schema.prisma": `datasource db {
  provider = "postgresql"
}

model Sale {
  id String @id
  price Int @default(
    0
  )
}
`}, prismaSources: []string{"prisma/schema.prisma"}, nonempty: true},
    {name: "prisma-absent-request", files: map[string]string{"prisma/schema.prisma": prismaBridgeSchema}, prismaSources: []string{"prisma/absent.prisma"}},
    {name: "swagger-readable-document", files: map[string]string{
      "swagger.json": `{"openapi":"3.1.0","info":{"title":"B","version":"1"},"paths":{"/members":{"post":{"responses":{"200":{"description":"OK"}}}}}}`,
    }, swaggerSource: "swagger.json", nonempty: true},
    {name: "swagger-readable-rejected-version", files: map[string]string{
      "broken.json": `{"openapi":"4.0.0","info":{"title":"B","version":"1"},"paths":{}}`,
    }, swaggerSource: "broken.json", nonempty: true},
    {name: "swagger-absent-document", swaggerSource: "absent.json"},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      root := t.TempDir()
      for path, content := range scenario.files {
        absolute := filepath.Join(root, filepath.FromSlash(path))
        if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
          t.Fatal(err)
        }
        if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
          t.Fatal(err)
        }
      }
      digest := ""
      if scenario.prismaSources != nil {
        digest = prismaContentDigest(root, scenario.prismaSources)
      } else {
        digest = swaggerContentDigest(root, scenario.swaggerSource)
      }
      if (digest != "") != scenario.nonempty {
        t.Fatalf("expected nonempty=%v for the authored readability, got %q", scenario.nonempty, digest)
      }
    })
  }
}
