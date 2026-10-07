package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies an exclusion in a shared file is placed by every name it is read by.
 *
 * `evidenceExcludeCarriers` confines a claim's exclusions to some of its own
 * files, and a hard link gives one file two names inside that claim; one of
 * which the carrier patterns select and one of which they do not. Deciding the
 * placement per name put the same tag in two places at once and reported
 * whichever name the walk read second, so a tag written exactly where the
 * configuration demands was refused for sitting somewhere it also is. The tag
 * is in a carrier when any name it is read by is one.
 *
 *  1. Hard-link one schema so a single claim selects it under two names.
 *  2. Confine the exclusions to the name the carriers select.
 *  3. Assert the exclusion is accepted and discharges its obligation.
 *
 * @evidence contracts/testing.md#behavioral-verification A schema carrying `/// @evidenceExclude docs/pricing.md#discounts ...` above model sale is hard-linked under store/ and mirror/; one prisma claim selects every .prisma file with evidenceExcludeCarriers limited to the mirror directory, against markdown docs/pricing.md. runIndexRuleAtRoot must report no message at all, i.e. the exclusion is accepted and the model's obligation to the discounts section is discharged.
 * @evidence contracts/testing.md#independent-expectations The expected result (silence) follows from the claim configuration: the tag sits in a file that one of its own names (mirror/main.prisma) selects as an exclusion carrier. Silence alone would also be produced if the exclusion obligation were dropped for another reason, and the refusal case (no carrier name selected) is not run here.
 * @evidence contracts/testing.md#distinguishing-cases Only the accepting layout runs: one file with two names, one of which matches the carrier pattern. No layout where no name is a carrier is exercised in this body, and the hard-link skip applies on filesystems without hard links.
 * @evidence contracts/testing.md#execution-ownership TestAnExclusionInASharedFileIsPlacedByEveryNameThatReadsIt is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
 */
func TestAnExclusionInASharedFileIsPlacedByEveryNameThatReadsIt(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidenceExclude docs/pricing.md#discounts Discounts are priced outside this table.\nmodel sale {\n  id String @id\n}\n",
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
  }, `{"claims":[{
    "type":"prisma",
    "files":["**/*.prisma"],
    "symbol":"model",
    "evidenceExcludeCarriers":["mirror/**"],
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  if len(messages) != 0 {
    t.Fatalf(
      "an exclusion inside the carriers owes nothing, got %d:\n%s",
      len(messages),
      strings.Join(messages, "\n"),
    )
  }
}
