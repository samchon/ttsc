package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a diagnostic for a shared schema names the one spelling the set has.
 *
 * The guide and the two TSDoc blocks promise this in words: a file both
 * populations reached is located by one of its spellings rather than by each
 * population's own, and it opens the same file either way. The unit's own
 * location is pinned beside the parse; this is the promise as an adopter meets
 * it, in a message, from the claim rooted at the other name.
 *
 *  1. Root two claims at the two names of one hard-linked schema.
 *  2. Write one citation in it whose target nothing materializes.
 *  3. Assert the report locates it at the set's spelling and at no other.
 *
 * @evidence contracts/testing.md#behavioral-verification A schema with a citation to the absent target docs/absent.md#nothing is hard-linked at store/ and mirror/; two prisma claims are rooted at the two names. runIndexRuleAtRoot must report "Unresolved evidence target 'docs/absent.md#nothing' at mirror/main.prisma:1" and no message may mention store/main.prisma.
 * @evidence contracts/testing.md#independent-expectations The expected spelling is the lexicographically smallest of the file's spellings, the rule distinctPrismaSources states (sorted spellings, first wins); the expected string is a literal authored from that rule, so this test pins the rule rather than deriving it independently from outside the implementation.
 * @evidence contracts/testing.md#distinguishing-cases The same citation is read from two claims rooted at the two names; the message must use mirror (smaller) and the other claim's name store must never appear. No case with a single name or a different ordering of names is run.
 * @evidence contracts/testing.md#execution-ownership TestADiagnosticForASharedSchemaNamesTheSetsSpelling is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
 */
func TestADiagnosticForASharedSchemaNamesTheSetsSpelling(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidence docs/absent.md#nothing Nothing materializes this target.\nmodel sale {\n  id String @id\n}\n",
  })
  if err := os.MkdirAll(filepath.Join(root, "mirror"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Link(
    filepath.Join(root, "store", "main.prisma"),
    filepath.Join(root, "mirror", "main.prisma"),
  ); err != nil {
    t.Skipf("this filesystem does not support hard links: %v", err)
  }
  messages := runIndexRuleAtRoot(t, root, map[string]string{
    "docs/pricing.md": "## Discounts {#discounts}\n",
  }, `{"claims":[
    {
      "type":"prisma",
      "root":"store",
      "files":["**/*.prisma"],
      "symbol":"model",
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    },
    {
      "type":"prisma",
      "root":"mirror",
      "files":["**/*.prisma"],
      "symbol":"model",
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    }
  ]}`)
  assertProblemContains(t, messages, "Unresolved evidence target 'docs/absent.md#nothing' at mirror/main.prisma:1")
  // The claim rooted at the other name reports the same location, because one
  // file has one location and both claims read it from the same parse.
  for _, message := range messages {
    if strings.Contains(message, "store/main.prisma") {
      t.Fatalf("a shared schema is located by the set's spelling alone:\n%s", message)
    }
  }
}
