package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// Filename directives describe portable corpus paths, not native path strings.
// The loader's source identity must point to the exact file the writer creates,
// even on hosts where a backslash would otherwise remain a filename character.
// @evidence contracts/testing.md#behavioral-verification The real loader interprets each authored filename directive, the materializer writes it, the reader opens the returned identity and the no-var Engine reports the original source's exact var range and filename.
// @evidence contracts/testing.md#independent-expectations Portable directive spelling accepts both separators and dot segments but yields the independently authored case-preserving src/Paths/Named.ts identity. Native conversion occurs only after that normalization; the literal var span and one diagnostic come from the fixture rather than the implementation.
// @evidence contracts/testing.md#distinguishing-cases Forward, single/doubled backslash, mixed separators and dot-segment spellings share one read/write identity without case folding. Escaping, absolute and outside-src names remain rejected. The slash invariant distinguishes the Linux literal-backslash failure even when this unit runs on Windows.
// @evidence contracts/testing.md#execution-ownership This Go unit discovers literal temporary corpus trees and reads materialized source through the same filepath.FromSlash boundary as TestLintFixtureCorpus, then invokes the parser and Engine directly; no installed consumer, product artifact or subprocess is used.
func TestLintCorpusFilenameSeparatorsShareMaterializedSourceIdentity(t *testing.T) {
  for _, spelling := range []string{
    "src/Paths/Named.ts",
    `src\Paths\Named.ts`,
    `src\\Paths\\Named.ts`,
    `src\Paths/Named.ts`,
    `src/Paths\Named.ts`,
    `src\Unused\..\Paths\.\Named.ts`,
  } {
    t.Run(spelling, func(t *testing.T) {
      source := "// @ttsc-corpus-filename: " + spelling + "\n// expect: no-var error\nvar legacy = 1;\n"
      corpusRoot := writeCorpusTree(t, map[string]string{"entry.ts": source})
      entries, err := loadLintCorpus(corpusRoot)
      if err != nil || len(entries) != 1 {
        t.Fatalf("load one renamed source: entries=%d err=%v", len(entries), err)
      }
      entry := entries[0]
      if entry.SourcePath != "src/Paths/Named.ts" {
        t.Fatalf("portable read identity: got %q, want src/Paths/Named.ts", entry.SourcePath)
      }
      projectRoot := t.TempDir()
      if err := materializeCorpusProject(projectRoot, entry); err != nil {
        t.Fatal(err)
      }
      location := filepath.Join(projectRoot, filepath.FromSlash(entry.SourcePath))
      bytes, err := os.ReadFile(location)
      if err != nil || string(bytes) != source {
        t.Fatalf("read materialized main through returned identity: source=%q err=%v", bytes, err)
      }
      file := parseTSFile(t, location, string(bytes))
      engine := NewEngine(RuleConfig{"no-var": SeverityError})
      findings := engine.Run([]*shimast.SourceFile{file}, nil)
      if err := validateSemanticRuleFindings(RuleConfig{"no-var": SeverityError}, findings); err != nil {
        t.Fatal(err)
      }
      if len(findings) != 1 {
        t.Fatalf("want one no-var diagnostic, got %+v", findings)
      }
      finding := findings[0]
      start := strings.Index(source, "var legacy")
      end := start + len("var legacy = 1;")
      if finding.Pos != start || finding.End != end || finding.File.FileName() != filepath.ToSlash(location) {
        t.Fatalf("main source identity/range: got %s [%d,%d), want %s [%d,%d)", finding.File.FileName(), finding.Pos, finding.End, filepath.ToSlash(location), start, end)
      }
    })
  }
  for _, spelling := range []string{`src\..\outside.ts`, `..\src\outside.ts`, `\src\absolute.ts`, `outside\file.ts`} {
    t.Run("reject-"+spelling, func(t *testing.T) {
      if _, err := corpusResolveSourcePath("// @ttsc-corpus-filename: "+spelling, "invalid.ts"); err == nil {
        t.Fatalf("outside project/include path accepted: %q", spelling)
      }
    })
  }
}
