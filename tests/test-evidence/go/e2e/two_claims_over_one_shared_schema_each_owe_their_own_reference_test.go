package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies two claims over one shared schema each owe their own reference.
 *
 * The product shape #1262 exists for, at the level an adopter meets it: a
 * package installed under `node_modules` and rooted again at its workspace
 * source is one schema owned by two claims, each answering to its own
 * documents. Before this pull request the whole set was rejected for a model
 * declared twice and neither claim owed anything. Both must now owe exactly
 * their own, and the host they name must be a path that opens; which for a
 * file both claims reached is one of its two spellings rather than each
 * claim's own, and this is where that becomes visible.
 *
 *  1. Hard-link one schema so two rooted claims each own a name for it.
 *  2. Give each claim a different document to answer to.
 *  3. Assert one acknowledgement per claim, each naming its own document.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRuleAtRoot is exercised with the scenario below; the assertions require one acknowledgement per claim, each naming its own document.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The product shape #1262 exists for, at the level an adopter meets it: a package installed under `node_modules` and rooted again at its workspace source is one schema owned by two claims, each answering to its own documents. Before this pull request the whole set was rejected for a model declared twice and neither claim owed anything. Both must now owe exactly their own, and the host they name must be a path that opens; which for a file both claims reached is one of its two spellings rather than each claim's own, and this is where that becomes visible.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Hard-link one schema so two rooted claims each own a name for it. Give each claim a different document to answer to. Assert one acknowledgement per claim, each naming its own document.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTwoClaimsOverOneSharedSchemaEachOweTheirOwnReference runs in tests/test-evidence/go/e2e, selected by the repository Go overlay runner in the shared native package process. prismaBridgeRoot resolves the installed package and loadPrismaInventories can launch its real Node parser.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary The Prisma Node bridge resolves the installed @ttsc/evidence loader and pinned parser for this shared-schema layout. A synthetic outcome cannot detect failed package resolution or transport of the schema set. Equivalent warm outcomes can bypass the process, so this entry verifies that two claims over one shared schema each owe their own reference. This entry does not independently prove a cold bridge launch.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution The overlay batch shares its Go process, installed @ttsc/evidence package and compiled Node loader. Schema outcomes are reused by content digest; different link layouts need separate fixture roots, not separate installations or native builds.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot gives this entry a separate temporary consumer root and registers removal with t.Cleanup. File links and graph inputs stay inside that root. The bounded schema cache may reuse identical bytes and representative paths across roots; this test does not require a cold parse.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestTwoClaimsOverOneSharedSchemaEachOweTheirOwnReference retains its original body, fixture inputs, skips and every assertion after transfer from one_schema_reached_by_two_roots_is_parsed_once_test.go. Its checks require one acknowledgement per claim, each naming its own document. The synthetic unlocated-model fan-out case remains a unit entry.
 */
func TestTwoClaimsOverOneSharedSchemaEachOweTheirOwnReference(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "model sale {\n  id String @id\n}\n",
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
    "docs/installed.md": "## Installed {#installed}\n",
    "docs/source.md":    "## Source {#source}\n",
  }, `{"claims":[
    {
      "type":"prisma",
      "root":"store",
      "files":["**/*.prisma"],
      "symbol":"model",
      "reference":{"type":"markdown","files":["docs/installed.md"],"symbol":"h2"}
    },
    {
      "type":"prisma",
      "root":"mirror",
      "files":["**/*.prisma"],
      "symbol":"model",
      "reference":{"type":"markdown","files":["docs/source.md"],"symbol":"h2"}
    }
  ]}`)
  if len(messages) != 2 {
    t.Fatalf(
      "two claims owe one acknowledgement each, got %d:\n%s",
      len(messages),
      strings.Join(messages, "\n"),
    )
  }
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/installed.md#installed'")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/source.md#source'")
  // One parse, one model, one location, named the same way to both claims.
  for _, message := range messages {
    if !strings.Contains(message, "on a selected prisma host") {
      t.Fatalf("each claim reports its own prisma obligation:\n%s", message)
    }
  }
}
