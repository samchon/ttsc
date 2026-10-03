package linthost

import (
  "strings"
  "testing"
)

// TestLintCorpusDiscoveryRejectsUnclassifiedSources verifies that a TypeScript
// source with no role cannot sit silently in the corpus.
//
// Filtering the corpus on parsed expectations would make an annotation typo
// indistinguishable from an unrelated file and silently drop its coverage.
// Discovery must enumerate every source first and then demand an explicit
// positive, clean, audited-skip or companion role.
//
// 1. Write one plain TypeScript file and one annotated entry to a corpus root.
// 2. Load the corpus.
// 3. Assert loading fails naming the plain file and its missing role.
//
// @evidence contracts/testing.md#behavioral-verification loadLintCorpus is called over a real temporary tree and must return an error naming the unclassified file; the annotated sibling alone loads cleanly, so the failure is attributable to the missing role.
// @evidence contracts/testing.md#independent-expectations The classification contract (every corpus source declares expectation, clean rule, audited skip or companion) is the specification; the expected message is a literal derived from it, not from loader output.
// @evidence contracts/testing.md#distinguishing-cases The unannotated file fails while a file carrying an expectation, and a file carrying only a clean directive, load; companion roles are covered by the companion-contract case.
// @evidence contracts/testing.md#execution-ownership TestLintCorpusDiscoveryRejectsUnclassifiedSources is a discoverable Go unit entry that calls the loader directly over t.TempDir files; no compiler, project load or native host runs.
func TestLintCorpusDiscoveryRejectsUnclassifiedSources(t *testing.T) {
  valid := map[string]string{
    "entry.ts": "// expect: fixture/rule error\nexport const violation = true;\n",
    "clean.ts": "// @ttsc-corpus-clean: fixture/rule\nexport const fine = true;\n",
  }
  entries, err := loadLintCorpus(writeCorpusTree(t, valid))
  if err != nil || len(entries) != 2 {
    t.Fatalf("annotated sources must load as two entries: %v %+v", err, entries)
  }
  valid["forgotten.ts"] = "export const forgotten = true;\n"
  _, err = loadLintCorpus(writeCorpusTree(t, valid))
  want := "forgotten.ts: a corpus source must declare an expectation, clean rule, audited skip, or @ttsc-corpus-companion"
  if err == nil || !strings.Contains(err.Error(), want) {
    t.Fatalf("want error containing %q, got %v", want, err)
  }
}
