package evidence

import (
  "fmt"
  "io/fs"
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestMarkdownCapturePreservesPopulationBoundaries verifies selection,
// activation, address and failure policy while observations are shared.
//
//  1. Contrast an inactive H1-only H2 claim with an active H2 claim and a
//     missing reference root; inspect actual input operations and findings.
//  2. Project malformed-heading and traversal-failure observations through
//     different claim/reference symbols and severity, without a second walk.
//  3. Read the same physical document in two root-relative address spaces and
//     retain distinct targets, units and first-observation owners. Contrast
//     ordered file exclusions, citation exclusions, reviews and unreadable tags.
//
// @evidence contracts/testing.md#behavioral-verification Real graph checks assert inactive references perform no root query, active missing roots report, raw scans project only selected-symbol problems at their strongest owning severity, failed traversal remains failed with one discovery, exclusion coverage passes until reviews are required, and an unreadable tag reports once. Direct inventory loads distinguish two addresses of one physical file and apply expanded file selection after an ordered exclusion.
// @evidence contracts/testing.md#independent-expectations H1 cannot activate an H2 claim, while an authored H2 must expose its missing reference. Literal anchor-problem severity and target/ID distinctions follow declared populations and rooted addressing, not cache-generated expectations.
// @evidence contracts/testing.md#distinguishing-cases Healthy inactive/active claims, claim-versus-reference H2 scan selection, warning/error owners, empty failed traversals, and default-versus-rooted addresses exercise the independent policy boundaries. The reuse test owns volume and expanded-glob controls; the refresh test owns content/failure transitions.
// @evidence contracts/testing.md#execution-ownership This named native Go unit owns its fixture subtests and directly invokes graph/inventory operations in-process. Public-reader fault injection models a root walk failure without relying on host permission policy; ordinary files and root resolution remain native. No native producer, external bridge or consumer installation runs.
func TestMarkdownCapturePreservesPopulationBoundaries(t *testing.T) {
  for _, active := range []bool{false, true} {
    t.Run(fmt.Sprintf("activation/%v", active), func(t *testing.T) {
      root := linkedPopulationWorkspace(t)
      content := "# Only H1 {#h1}\n"
      if active {
        content = "## Active H2 {#h2}\n"
      }
      writeMarkdownCaptureFiles(t, root, map[string]string{"claim.md": content})
      options := `{"claims":[{"type":"markdown","files":["claim.md"],"symbol":"h2","reference":{"type":"markdown","root":"missing","files":["**/*.md"],"symbol":"h2"}}]}`
      reader := &markdownCaptureReader{}
      reporter := runMarkdownCaptureGraph(t, root, options, reader)
      if active {
        assertProblemContains(t, reporter.messages, "markdown root 'missing'")
        if reader.stats[filepath.Join(root, "missing")] == 0 {
          t.Fatal("active reference root was not queried")
        }
      } else {
        assertNoProblems(t, reporter.messages)
        if reader.stats[filepath.Join(root, "missing")] != 0 {
          t.Fatal("inactive reference root was queried")
        }
      }
      if reader.reads[filepath.Join(root, "claim.md")] != 1 || len(reader.walks) != 1 {
        t.Fatal("claim observation repeated")
      }
    })
  }
  for _, referenceH2 := range []bool{false, true} {
    t.Run(fmt.Sprintf("symbol severity/%v", referenceH2), func(t *testing.T) {
      root := linkedPopulationWorkspace(t)
      writeMarkdownCaptureFiles(t, root, map[string]string{"doc.md": "# Header {#header}\n<!-- @evidence doc.md#header Covers the scope. -->\n## ---\n"})
      symbol := "h1"
      if referenceH2 {
        symbol = "h2"
      }
      options := fmt.Sprintf(`{"claims":[{"type":"markdown","files":["doc.md"],"symbol":"h1","severity":"warning","reference":{"type":"markdown","files":["doc.md"],"symbol":%q,"severity":"error"}}]}`, symbol)
      reader := &markdownCaptureReader{}
      reporter := runMarkdownCaptureGraph(t, root, options, reader)
      if referenceH2 {
        count := 0
        for _, finding := range reporter.findings {
          if countProblemsContaining([]string{finding.Message}, "has no resolvable anchor") != 0 {
            count++
            if finding.Severity != rule.SeverityError {
              t.Fatalf("reference problem severity=%v", finding.Severity)
            }
          }
        }
        if count != 1 {
          t.Fatalf("selected reference H2 problems=%d: %v", count, reporter.messages)
        }
        if len(markdownCaptureHints(root, options, reporter)) != 0 {
          t.Fatal("scan finding published Hints")
        }
      } else {
        assertNoProblems(t, reporter.messages)
      }
      if reader.reads[filepath.Join(root, "doc.md")] != 1 || len(reader.walks) != 1 {
        t.Fatal("symbol/severity change repeated content discovery")
      }
    })
  }
  t.Run("declared claim problem precedes activation", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    writeMarkdownCaptureFiles(t, root, map[string]string{"doc.md": "## ---\n"})
    options := `{"claims":[{"type":"markdown","files":["doc.md"],"symbol":"h2","severity":"warning","reference":{"type":"markdown","root":"missing","files":["**/*.md"],"symbol":"h2","severity":"error"}}]}`
    reader := &markdownCaptureReader{}
    reporter := runMarkdownCaptureGraph(t, root, options, reader)
    if len(reporter.findings) != 1 || reporter.findings[0].Severity != rule.SeverityWarn {
      t.Fatalf("claim findings=%v", reporter.findings)
    }
    assertProblemContains(t, reporter.messages, "has no resolvable anchor")
    if reader.stats[filepath.Join(root, "missing")] != 0 {
      t.Fatal("inactive malformed claim loaded its reference")
    }
  })
  t.Run("walk failure keeps strongest active owner", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    reader := &markdownCaptureReader{walkFailures: map[string]error{root: fs.ErrPermission}}
    options := `{"claims":[{"type":"markdown","files":["doc.md"],"symbol":"h2","severity":"warning","reference":{"type":"markdown","files":["doc.md"],"symbol":"h2","severity":"error"}}]}`
    reporter := runMarkdownCaptureGraph(t, root, options, reader)
    if len(reader.walks) != 1 || len(reporter.findings) != 1 || reporter.findings[0].Severity != rule.SeverityError || !reader.unavailable {
      t.Fatalf("failed walk lost ownership: walks=%v findings=%v unavailable=%v", reader.walks, reporter.findings, reader.unavailable)
    }
    assertProblemContains(t, reporter.messages, "could not walk Markdown root")
    if reporter.state.(*graphCycleState).Corpus.Markdown != nil {
      t.Fatal("failed traversal published Corpus")
    }
  })
  t.Run("broader discovery cannot repair a captured root failure", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    writeMarkdownCaptureFiles(t, root, map[string]string{"docs/claim.md": "## Claim {#claim}\n<!-- @evidence extra/ref.md#ref Answers the reference. -->\n", "extra/ref.md": "## Ref {#ref}\n"})
    reader := &markdownCaptureReader{walkFailures: map[string]error{root: fs.ErrPermission}}
    reader.afterWalk = func() { delete(reader.walkFailures, root); reader.afterWalk = nil }
    options := `{"claims":[{"type":"markdown","files":["docs/*.md"],"symbol":"h2","severity":"warning","reference":{"type":"markdown","files":["extra/*.md"],"symbol":"h2","severity":"error"}}]}`
    first := runMarkdownCaptureGraph(t, root, options, reader)
    if len(reader.walks) != 1 || len(first.findings) != 1 || first.findings[0].Severity != rule.SeverityError {
      t.Fatalf("root failure was retried or lost: walks=%v findings=%v", reader.walks, first.findings)
    }
    second := runMarkdownCaptureGraph(t, root, options, reader)
    assertNoProblems(t, second.messages)
    if reader.reads[filepath.Join(root, "docs", "claim.md")] != 1 || reader.reads[filepath.Join(root, "extra", "ref.md")] != 1 || !reader.unavailable {
      t.Fatal("next Check did not refresh repaired inputs with sticky reader withdrawal")
    }
  })
  t.Run("broader discovery retains a failed directory observation", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    private := filepath.Join(root, "docs", "private")
    writeMarkdownCaptureFiles(t, root, map[string]string{"docs/public.md": "## Public {#public}\n", "docs/private/hidden.md": "## Hidden {#hidden}\n"})
    reader := &markdownCaptureReader{entryFailures: map[string]error{private: fs.ErrPermission}}
    reader.afterWalk = func() { delete(reader.entryFailures, private); reader.afterWalk = nil }
    config := decodeInventoryConfig(t, root, `{"claims":[{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2","reference":{"type":"markdown","files":["**/*.md"],"symbol":"h2"}}]}`)
    config.inputs = evidenceInputReader{host: reader}
    resolveGraphBases(root, &config)
    capture := &markdownCapture{}
    _, firstProblems := loadMarkdownInventories(root, claimPopulationConfig(config, artifactMarkdown), capture)
    assertProblemContains(t, firstProblems, "could not inspect 'docs/private'")
    complete, problems := loadMarkdownInventories(root, config, capture)
    assertProblemContains(t, problems, "could not inspect 'docs/private'")
    base := config.Claims[0].Base
    if populationIsHealthy(complete, base, matchingInventoryPaths(complete, base, config.Claims[0].Files)) || reader.reads[filepath.Join(private, "hidden.md")] != 0 {
      t.Fatal("new selection erased a failed directory observation")
    }
    refreshed, refreshProblems := loadMarkdownInventories(root, config)
    assertNoProblems(t, refreshProblems)
    if !populationIsHealthy(refreshed, base, matchingInventoryPaths(refreshed, base, config.Claims[0].Files)) || reader.reads[filepath.Join(private, "hidden.md")] != 1 {
      t.Fatal("fresh capture did not observe repaired directory")
    }
  })
  t.Run("broader discovery retains a disappeared failed directory", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    private := filepath.Join(root, "docs", "private")
    hidden := filepath.Join(private, "hidden.md")
    writeMarkdownCaptureFiles(t, root, map[string]string{"docs/public.md": "## Public {#public}\n", "docs/private/hidden.md": "## Hidden {#hidden}\n"})
    reader := &markdownCaptureReader{entryFailures: map[string]error{private: fs.ErrPermission}}
    reader.afterWalk = func() {
      if err := os.Remove(hidden); err != nil {
        t.Fatal(err)
      }
      if err := os.Remove(private); err != nil {
        t.Fatal(err)
      }
      reader.afterWalk = nil
    }
    config := decodeInventoryConfig(t, root, `{"claims":[{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2","severity":"warning","reference":{"type":"markdown","files":["**/*.md"],"symbol":"h2","severity":"error"}}]}`)
    resolveGraphSeverities(&config, rule.SeverityError)
    config.inputs = evidenceInputReader{host: reader}
    resolveGraphBases(root, &config)
    capture := &markdownCapture{}
    _, firstProblems := loadMarkdownInventories(root, claimPopulationConfig(config, artifactMarkdown), capture)
    assertProblemContains(t, firstProblems, "could not inspect 'docs/private'")
    complete, problems := loadMarkdownInventories(root, config, capture)
    assertProblemContains(t, problems, "could not inspect 'docs/private'")
    if populationIsHealthy(complete, config.Claims[0].Base, nil) {
      t.Fatal("new traversal erased an absent failed observation")
    }
    if len(problems) != 1 || problems[0].Severity != rule.SeverityError {
      t.Fatalf("absent failure lost reference severity: %v", problems)
    }
    refreshed, refreshProblems := loadMarkdownInventories(root, config)
    assertNoProblems(t, refreshProblems)
    if !populationIsHealthy(refreshed, config.Claims[0].Base, nil) {
      t.Fatal("fresh capture retained an earlier failed directory")
    }
  })
  t.Run("one physical file keeps two citation spaces", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    writeMarkdownCaptureFiles(t, root, map[string]string{"docs/doc.md": "## Entry {#entry}\n"})
    config := decodeInventoryConfig(t, root, `{"claims":[{"type":"typescript","files":["src/**"],"reference":[{"type":"markdown","files":["docs/doc.md"],"symbol":"h2"},{"type":"markdown","root":"docs","files":["doc.md"],"symbol":"h2"}]}]}`)
    reader := &markdownCaptureReader{}
    config.inputs = evidenceInputReader{host: reader}
    resolveGraphBases(root, &config)
    capture := &markdownCapture{}
    inventories, problems := loadMarkdownInventories(root, config, capture)
    assertNoProblems(t, problems)
    defaultInventory := inventories["docs/doc.md"]
    rootedInventory := inventories[resolvePopulationBase(root, "docs").address("doc.md")]
    if len(inventories) != 2 || defaultInventory == nil || rootedInventory == nil || defaultInventory == rootedInventory {
      t.Fatal("distinct address spaces were collapsed")
    }
    if defaultInventory.Units[1].Target != "docs/doc.md#entry" || rootedInventory.Units[1].Target != "doc.md#entry" || defaultInventory.Units[1].ID == rootedInventory.Units[1].ID {
      t.Fatal("root-relative unit identity was lost")
    }
    if reader.reads[filepath.Join(root, "docs", "doc.md")] != 2 || len(reader.walks) != 2 {
      t.Fatal("different address interpretation shared a capture")
    }
    again, repeatProblems := loadMarkdownInventories(root, config, capture)
    assertNoProblems(t, repeatProblems)
    if again["docs/doc.md"] != defaultInventory || reader.reads[filepath.Join(root, "docs", "doc.md")] != 2 || len(reader.walks) != 2 {
      t.Fatal("equivalent address space was not reused")
    }
  })
  t.Run("ordered file exclusions do not hide later references", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    writeMarkdownCaptureFiles(t, root, map[string]string{"docs/public.md": "## Public {#public}\n", "docs/private.md": "## Private {#private}\n"})
    config := decodeInventoryConfig(t, root, `{"claims":[{"type":"markdown","files":["docs/*.md","!docs/private.md"],"symbol":"h2","reference":{"type":"markdown","files":["docs/*.md"],"symbol":"h2"}}]}`)
    reader := &markdownCaptureReader{}
    config.inputs = evidenceInputReader{host: reader}
    resolveGraphBases(root, &config)
    capture := &markdownCapture{}
    claims, claimProblems := loadMarkdownInventories(root, claimPopulationConfig(config, artifactMarkdown), capture)
    assertNoProblems(t, claimProblems)
    if len(claims) != 1 || reader.reads[filepath.Join(root, "docs", "private.md")] != 0 {
      t.Fatal("claim file exclusion was ignored")
    }
    complete, problems := loadMarkdownInventories(root, config, capture)
    assertNoProblems(t, problems)
    if len(complete) != 2 || reader.reads[filepath.Join(root, "docs", "private.md")] != 1 || reader.reads[filepath.Join(root, "docs", "public.md")] != 1 || len(reader.walks) != 2 {
      t.Fatal("expanded reference selection reused an incomplete traversal or repeated parsing")
    }
  })
  t.Run("literal leading exclusion marker keeps its glob meaning", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    writeMarkdownCaptureFiles(t, root, map[string]string{"!docs/item.md": "## Literal {#literal}\n", "other/item.md": "## Other {#other}\n"})
    reader := &markdownCaptureReader{}
    capture := &markdownCapture{}
    for _, literal := range []bool{false, true} {
      pattern := "!docs/**"
      if literal {
        pattern = "./!docs/**"
      }
      config := decodeInventoryConfig(t, root, fmt.Sprintf(`{"claims":[{"type":"markdown","files":[%q,"other/**"],"symbol":"h2","reference":{"type":"markdown","files":["other/**"],"symbol":"h2"}}]}`, pattern))
      config.inputs = evidenceInputReader{host: reader}
      resolveGraphBases(root, &config)
      inventories, problems := loadMarkdownInventories(root, claimPopulationConfig(config, artifactMarkdown), capture)
      assertNoProblems(t, problems)
      expected := 1
      if literal {
        expected = 2
      }
      if len(inventories) != expected {
        t.Fatalf("literal=%v inventories=%v", literal, inventories)
      }
    }
    if len(reader.walks) != 2 || reader.reads[filepath.Join(root, "!docs", "item.md")] != 1 || reader.reads[filepath.Join(root, "other", "item.md")] != 1 {
      t.Fatal("distinct glob meaning shared a pruned traversal")
    }
  })
  for _, requireReview := range []bool{false, true} {
    t.Run(fmt.Sprintf("exclusion review/%v", requireReview), func(t *testing.T) {
      root := linkedPopulationWorkspace(t)
      writeMarkdownCaptureFiles(t, root, map[string]string{"doc.md": "## Entry {#entry}\n<!-- @evidenceExclude doc.md#entry This claim does not implement the requirement. -->\n"})
      options := fmt.Sprintf(`{"claims":[{"type":"markdown","files":["doc.md"],"symbol":"h2","reference":{"type":"markdown","files":["doc.md"],"symbol":"h2","requireReview":%t}}]}`, requireReview)
      reader := &markdownCaptureReader{}
      reporter := runMarkdownCaptureGraph(t, root, options, reader)
      if requireReview {
        if countProblemsContaining(reporter.messages, "Unreviewed @evidenceExclude") != 1 {
          t.Fatalf("exclusion review findings=%v", reporter.messages)
        }
        if len(markdownCaptureHints(root, options, reporter)) != 0 {
          t.Fatal("unreviewed exclusion published Hints")
        }
      } else {
        assertNoProblems(t, reporter.messages)
        inventory := reporter.state.(*graphCycleState).Corpus.Markdown["doc.md"]
        if len(inventory.Declarations) != 1 || inventory.Declarations[0].Tag != tagExclude {
          t.Fatal("capture lost exclusion meaning")
        }
      }
      if reader.reads[filepath.Join(root, "doc.md")] != 1 || len(reader.walks) != 1 {
        t.Fatal("exclusion policy repeated the captured analysis")
      }
    })
  }
  t.Run("unreadable tags report once", func(t *testing.T) {
    root := linkedPopulationWorkspace(t)
    writeMarkdownCaptureFiles(t, root, map[string]string{"doc.md": "## Entry {#entry}\n<!-- @evidence doc.md#entry Self. -->\n@evidenceReview doc.md#entry This prose is not a readable review.\n"})
    options := `{"claims":[{"type":"markdown","files":["doc.md"],"symbol":"h2","reference":{"type":"markdown","files":["doc.md"],"symbol":"h2"}}]}`
    reader := &markdownCaptureReader{}
    reporter := runMarkdownCaptureGraph(t, root, options, reader)
    if countProblemsContaining(reporter.messages, "Unreadable @evidenceReview") != 1 || reader.reads[filepath.Join(root, "doc.md")] != 1 || len(reader.walks) != 1 {
      t.Fatalf("unreadable annotation capture=%v reads=%v walks=%v", reporter.messages, reader.reads, reader.walks)
    }
  })
}
