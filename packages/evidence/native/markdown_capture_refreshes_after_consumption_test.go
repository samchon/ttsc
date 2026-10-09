package evidence

import (
  "crypto/sha256"
  "encoding/hex"
  "io/fs"
  "os"
  "path/filepath"
  "slices"
  "testing"
)

// TestMarkdownCaptureRefreshesAfterConsumption verifies first-observation
// ownership and renewal across Checks, including failed or withdrawn reads.
//
//  1. Edit a document immediately after its first bytes are consumed, then
//     require evaluation, Hints and the retained witness to describe those bytes.
//  2. Run another Check and require its inventory and witness to see the edit.
//  3. Repair a failed read between phases and require the first Check to fail,
//     while the next Check succeeds; retain explicit authority withdrawal too.
//  4. Delete an already consumed claim before expanded reference discovery,
//     retaining its first inventory until the next Check observes absence.
//
// @evidence contracts/testing.md#behavioral-verification Direct graphRule.Check and Hints calls distinguish the first anchor from a post-consumption edit, then the next Check sees the replacement. Exact returned-byte SHA-256 witnesses, read counts, failed Corpus publication, repair and sticky Unavailable assertions exercise the supported reader boundary.
// @evidence contracts/testing.md#independent-expectations Literal old/new anchors and independently hashed authored byte strings define the snapshot oracle. A failed first consumption cannot become a healthy inventory by a phase retry. Unavailable is one-way withdrawal; the graph cannot restore it merely because parsing succeeded.
// @evidence contracts/testing.md#distinguishing-cases Successful content changes contrast with deletion before a broader traversal, an injected permission failure repaired after consumption and a successful read that withdraws observation authority. Reusing the same reader across fresh Checks makes accidental cross-Check inventory retention observable.
// @evidence contracts/testing.md#execution-ownership This native Go unit owns its subtests, reader hooks and temporary files. It calls the real graph and Hints APIs in-process without a built host or consumer installation. The reader seam models explicit failures and records actual OS-returned bytes; native host publication and downstream proof replay remain independently tested by their owners.
func TestMarkdownCaptureRefreshesAfterConsumption(t *testing.T) {
  options := `{"claims":[{"type":"markdown","files":["doc.md"],"symbol":"h2","reference":{"type":"markdown","files":["doc.md"],"symbol":"h2"}}]}`
  oldContent := "## Original {#original}\n<!-- @evidence doc.md#original Original snapshot. -->\n"
  newContent := "## Changed {#changed}\n<!-- @evidence doc.md#changed Changed snapshot. -->\n"
  t.Run("changed after consumption", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    document := filepath.Join(root, "doc.md")
    writeMarkdownCaptureFiles(t, root, map[string]string{"doc.md": oldContent})
    reader := &markdownCaptureReader{}
    reader.afterRead = func(name string) {
      if name == document {
        writeMarkdownCaptureFiles(t, root, map[string]string{"doc.md": newContent})
        reader.afterRead = nil
      }
    }
    first := runMarkdownCaptureGraph(t, root, options, reader)
    assertNoProblems(t, first.messages)
    oldDigest := sha256.Sum256([]byte(oldContent))
    newDigest := sha256.Sum256([]byte(newContent))
    firstWitness := reader.hashes[document]
    if firstWitness != hex.EncodeToString(oldDigest[:]) || firstWitness == hex.EncodeToString(newDigest[:]) {
      t.Fatal("consumed witness was replaced with later content")
    }
    firstInserts := targetInserts(markdownCaptureHints(root, options, first))
    if !slices.Contains(firstInserts, "doc.md#original") || slices.Contains(firstInserts, "doc.md#changed") {
      t.Fatalf("first Hints=%q", firstInserts)
    }
    if reader.reads[document] != 1 {
      t.Fatalf("first Check reads=%d", reader.reads[document])
    }
    firstInventory := first.state.(*graphCycleState).Corpus.Markdown["doc.md"]
    second := runMarkdownCaptureGraph(t, root, options, reader)
    assertNoProblems(t, second.messages)
    secondInserts := targetInserts(markdownCaptureHints(root, options, second))
    if !slices.Contains(secondInserts, "doc.md#changed") || slices.Contains(secondInserts, "doc.md#original") {
      t.Fatalf("next Hints=%q", secondInserts)
    }
    if reader.reads[document] != 2 || reader.hashes[document] != hex.EncodeToString(newDigest[:]) {
      t.Fatal("next Check did not consume the edited bytes")
    }
    secondInventory := second.state.(*graphCycleState).Corpus.Markdown["doc.md"]
    if firstInventory == secondInventory || firstInventory.Units[1].Digest == secondInventory.Units[1].Digest {
      t.Fatal("new content retained the old inventory or review fingerprint")
    }
    if firstInventory.Units[1].Target != "doc.md#original" {
      t.Fatal("later Check mutated the earlier published snapshot")
    }
  })
  t.Run("failed first observation stays failed", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    document := filepath.Join(root, "doc.md")
    writeMarkdownCaptureFiles(t, root, map[string]string{"doc.md": oldContent})
    reader := &markdownCaptureReader{failures: map[string]error{document: fs.ErrPermission}}
    reader.afterRead = func(name string) { delete(reader.failures, name); reader.afterRead = nil }
    first := runMarkdownCaptureGraph(t, root, options, reader)
    assertProblemContains(t, first.messages, "could not read Markdown file 'doc.md'")
    if reader.reads[document] != 1 || !reader.unavailable {
      t.Fatal("failed observation was retried or certified")
    }
    if first.state.(*graphCycleState).Corpus.Markdown != nil || len(markdownCaptureHints(root, options, first)) != 0 {
      t.Fatal("failed consumption published a completion corpus")
    }
    second := runMarkdownCaptureGraph(t, root, options, reader)
    assertNoProblems(t, second.messages)
    if reader.reads[document] != 2 || !reader.unavailable {
      t.Fatal("next Check failed to retry or reset the reader's sticky withdrawal")
    }
  })
  t.Run("successful bytes cannot restore authority", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    document := filepath.Join(root, "doc.md")
    writeMarkdownCaptureFiles(t, root, map[string]string{"doc.md": oldContent})
    reader := &markdownCaptureReader{}
    reader.afterRead = func(string) { reader.Unavailable() }
    reporter := runMarkdownCaptureGraph(t, root, options, reader)
    assertNoProblems(t, reporter.messages)
    if !reader.unavailable || reader.reads[document] != 1 || reader.hashes[document] == "" {
      t.Fatal("capture lost the actual consumption or withdrawal")
    }
  })
  t.Run("expanded discovery retains a deleted captured claim", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    document := filepath.Join(root, "docs", "claim.md")
    writeMarkdownCaptureFiles(t, root, map[string]string{
      "docs/claim.md": "## Claim {#claim}\n<!-- @evidence docs/claim.md#claim Self. -->\n<!-- @evidence docs/other.md#other Adopts the other requirement. -->\n",
      "docs/other.md": "## Other {#other}\n",
    })
    options := `{"claims":[{"type":"markdown","files":["docs/claim.md"],"symbol":"h2","reference":{"type":"markdown","files":["docs/*.md"],"symbol":"h2"}}]}`
    reader := &markdownCaptureReader{}
    reader.afterRead = func(name string) {
      if name == document {
        if err := os.Remove(document); err != nil {
          t.Fatal(err)
        }
        reader.afterRead = nil
      }
    }
    first := runMarkdownCaptureGraph(t, root, options, reader)
    assertNoProblems(t, first.messages)
    if first.state.(*graphCycleState).Corpus.Markdown["docs/claim.md"] == nil || !slices.Contains(targetInserts(markdownCaptureHints(root, options, first)), "docs/claim.md#claim") {
      t.Fatal("later discovery discarded the first consumed inventory")
    }
    if reader.reads[document] != 1 || reader.reads[filepath.Join(root, "docs", "other.md")] != 1 {
      t.Fatal("expanded discovery repeated or skipped consumption")
    }
    second := runMarkdownCaptureGraph(t, root, options, reader)
    assertNoProblems(t, second.messages)
    if len(second.state.(*graphCycleState).Corpus.Markdown) != 0 || len(markdownCaptureHints(root, options, second)) != 0 {
      t.Fatal("next Check did not observe claim deletion")
    }
    if reader.reads[filepath.Join(root, "docs", "other.md")] != 1 {
      t.Fatal("deleted inactive claim loaded its reference on the next Check")
    }
  })
}
