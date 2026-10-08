package evidence

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"
)

// TestMarkdownCaptureReusesAnalysisWithinOneCheck verifies shared Markdown
// analysis without changing active-reference coverage.
//
// 1. Check overlapping populations of one, ten and one hundred documents.
// 2. Check reference-only documents and a reference expanding the claim glob.
// 3. Require clean graphs, one raw read per address and one traversal for an
//    unchanged file selection; expanded selections may need another traversal.
//
// @evidence contracts/testing.md#behavioral-verification The actual graphRule.Check reads fixture documents through ProjectContext.Inputs. Exact per-file read and walk counts expose repeated preparation, while zero diagnostics and selected inventory units require real parsing and graph evaluation.
// @evidence contracts/testing.md#independent-expectations Authored self-citations and a claim citing every reference define complete coverage independently of the loader. One consumption per addressed file and one discovery for an identical file selection follow the Check-local snapshot contract, without elapsed-time expectations.
// @evidence contracts/testing.md#distinguishing-cases Singleton, ten and hundred-document overlap contrast with reference-only documents and a new reference glob that expands discovery. An unrelated directory is excluded and must supply no document read.
// @evidence contracts/testing.md#execution-ownership This named Go unit owns all subtests and uses native temporary files with direct graphRule.Check calls in the same process. No consumer install, native producer build, compiler subprocess or external artifact bridge is started.
func TestMarkdownCaptureReusesAnalysisWithinOneCheck(t *testing.T) {
  for _, count := range []int{1, 10, 100} {
    for _, mode := range []string{"overlap", "reference-only", "expanded"} {
      t.Run(fmt.Sprintf("%s/%d", mode, count), func(t *testing.T) {
        root := linkedPopulationWorkspace(t)
        files := map[string]string{"unrelated/ignored.md": "## Not selected {#ignored}\n"}
        var citations strings.Builder
        for i := 0; i < count; i++ {
          path := fmt.Sprintf("docs/%d.md", i)
          files[path] = "## Entry {#entry}\n<!-- @evidence " + path + "#entry Self. -->\n"
          citations.WriteString("<!-- @evidence " + path + "#entry Complete coverage. -->\n")
        }
        claim := "docs/*.md"
        if mode == "reference-only" {
          claim = "claim.md"
          files[claim] = "## Claim {#claim}\n" + citations.String()
        } else if mode == "expanded" {
          claim = "docs/0.md"
          files[claim] = "## Entry {#entry}\n" + citations.String()
        }
        writeMarkdownCaptureFiles(t, root, files)
        options := fmt.Sprintf(`{"claims":[{"type":"markdown","files":[%q],"symbol":"h2","reference":{"type":"markdown","files":["docs/*.md"],"symbol":"h2"}}]}`, claim)
        reader := &markdownCaptureReader{}
        reporter := runMarkdownCaptureGraph(t, root, options, reader)
        assertNoProblems(t, reporter.messages)
        expectedWalks := 1
        if mode != "overlap" { expectedWalks = 2 }
        if len(reader.walks) != expectedWalks { t.Fatalf("walks=%d want %d", len(reader.walks), expectedWalks) }
        for i := 0; i < count; i++ {
          path := filepath.Join(root, "docs", fmt.Sprintf("%d.md", i))
          if reader.reads[path] != 1 { t.Errorf("%s reads=%d want 1", path, reader.reads[path]) }
        }
        if mode == "reference-only" && reader.reads[filepath.Join(root, "claim.md")] != 1 { t.Error("claim was not captured once") }
        if reader.reads[filepath.Join(root, "unrelated", "ignored.md")] != 0 { t.Error("unselected document was consumed") }
        corpus := reporter.state.(*graphCycleState).Corpus
        inventory := corpus.Markdown["docs/0.md"]
        if inventory == nil || len(inventory.Units) != 2 || inventory.Units[1].Target != "docs/0.md#entry" { t.Fatalf("captured inventory=%#v", inventory) }
      })
    }
  }
}
