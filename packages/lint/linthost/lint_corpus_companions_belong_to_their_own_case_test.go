package linthost

import (
  "reflect"
  "sort"
  "testing"
)

// TestLintCorpusCompanionsBelongToTheirOwnCase verifies that an entry consumes
// only the marked companions of its own case, once, at their project paths.
//
// The grouped-case root is the entry's directory, not the first path segment
// named `src`, and a nested grouped case must keep its companion to itself
// instead of letting the outer entry collect it recursively.
//
//  1. Write an outer entry, a nested entry and one marked companion under each
//     case's `src/`, below a directory that is itself named `src`.
//  2. Load the corpus and require the two entries, without the companions.
//  3. Assert each entry carries exactly its own companion at `src/<name>.ts`.
//
// @evidence contracts/testing.md#behavioral-verification loadLintCorpus resolves entries and their companion maps from a real tree; the outer entry must hold src/outer.ts only, the nested entry src/nested.ts only, and neither path may be doubled as src/src/.
// @evidence contracts/testing.md#independent-expectations The expected companion paths are the literal case-root-relative paths of the authored files; ownership follows the written contract that a companion belongs to the case directory containing it under src/.
// @evidence contracts/testing.md#distinguishing-cases A directory named src above the case, a nested case under another case, and one companion per case distinguish first-segment guessing, recursive over-collection and path doubling.
// @evidence contracts/testing.md#execution-ownership TestLintCorpusCompanionsBelongToTheirOwnCase is a discoverable Go unit entry calling the loader over a t.TempDir tree; no project is materialized, compiled or linted.
func TestLintCorpusCompanionsBelongToTheirOwnCase(t *testing.T) {
  root := writeCorpusTree(t, map[string]string{
    "examples/src/outer/violation.ts":         "// expect: fixture/outer error\nexport const outer = true;\n",
    "examples/src/outer/src/outer.ts":         "// @ttsc-corpus-companion\nexport const outerHelper = true;\n",
    "examples/src/outer/nested/violation.ts":  "// expect: fixture/nested error\nexport const nested = true;\n",
    "examples/src/outer/nested/src/nested.ts": "// @ttsc-corpus-companion\nexport const nestedHelper = true;\n",
  })
  entries, err := loadLintCorpus(root)
  if err != nil {
    t.Fatal(err)
  }
  if len(entries) != 2 {
    t.Fatalf("want two entries, got %+v", entries)
  }
  companions := map[string][]string{}
  for _, entry := range entries {
    for name := range entry.Companions {
      companions[entry.RelativeFile] = append(companions[entry.RelativeFile], name)
    }
    sort.Strings(companions[entry.RelativeFile])
  }
  want := map[string][]string{
    "examples/src/outer/violation.ts":        {"src/outer.ts"},
    "examples/src/outer/nested/violation.ts": {"src/nested.ts"},
  }
  if !reflect.DeepEqual(companions, want) {
    t.Fatalf("companions %v, want %v", companions, want)
  }
}
