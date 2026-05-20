// Autofix orchestration for the `@ttsc/lint fix` subcommand.
//
// RunFix drives the fix cascade: it applies ESLint runtime fixes first
// (one pass, external process), then repeatedly runs the native lint
// engine and applies any emitted TextEdit suggestions until no more
// fixable findings remain or maxFixPasses is reached. After the cascade
// settles, it runs a final diagnostic pass so remaining issues are
// surfaced in the normal error stream.
package linthost

import (
  "fmt"
  "os"
  "path/filepath"
  "sort"

  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
)

// maxFixPasses bounds the native cascade after the one-shot ESLint runtime
// pass. Real-world cascades (no-var → prefer-const → eqeqeq …) settle in a
// handful of passes; the cap exists so a buggy rule that re-reports its own
// edit cannot loop forever.
const maxFixPasses = 10

// RunFix implements `@ttsc/lint fix` — apply autofixes, then report any
// remaining type or lint diagnostics without emitting JavaScript.
func RunFix(args []string) int {
  opts, err := parseSubcommandFlags("fix", args)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  if opts.emit {
    fmt.Fprintln(os.Stderr, "@ttsc/lint fix: --emit is not supported")
    return 2
  }
  opts.noEmit = true
  return runFix(opts)
}

func runFix(opts *subcommandOpts) int {
  rules, err := loadRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }

  prog, code := loadFixProgram(opts)
  if code != 0 {
    return code
  }
  defer func() {
    if prog != nil {
      prog.close()
    }
  }()

  totalFixes := 0
  if fixed, err := runExternalESLintFixes(rules, opts.cwd, prog.userSourceFiles()); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  } else if fixed > 0 {
    totalFixes += fixed
    prog, code = reloadFixProgram(prog, opts)
    if code != 0 {
      return code
    }
  }

  // `ttsc fix` applies edits from BOTH lint-class rules and
  // format-class rules. The dual `ttsc format` subcommand exists for
  // the format-only path; fix is the "run everything" entry point so
  // users don't have to chain two invocations. The engine emits both
  // kinds of findings in one pass — no filtering needed here.
  cascadeConverged := false
  for pass := 0; pass < maxFixPasses; pass++ {
    engine := NewEngineWithResolver(rules)
    findings := engine.Run(prog.userSourceFiles(), prog.checker)
    fixed, err := applyFindingFixes(opts.cwd, findings)
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 3
    }
    if fixed == 0 {
      cascadeConverged = true
      break
    }
    totalFixes += fixed
    prog, code = reloadFixProgram(prog, opts)
    if code != 0 {
      return code
    }
  }
  if !cascadeConverged {
    // A non-converged exit means at least one rule kept emitting
    // edits on every pass — typically a buggy fixer that doesn't
    // settle the diagnostic it produces. The remaining findings still
    // surface below as ordinary diagnostics, and the exit code below
    // is bumped to 2 so a CI gate like `ttsc fix && echo ok` does not
    // silently accept the buggy-fixer state.
    fmt.Fprintf(os.Stderr,
      "@ttsc/lint: fix cascade did not converge after %d passes; remaining diagnostics are reported below\n",
      maxFixPasses)
  }

  engine := NewEngineWithResolver(rules)
  astDiags, lintDiags, externalRan, err := collectDiagnostics(prog, engine)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  if !externalRan {
    warnUnknownRules(os.Stderr, engine.UnknownRules())
  }
  errCount := shimdw.FormatMixedDiagnostics(os.Stderr, astDiags, lintDiags, opts.cwd)
  if errCount > 0 {
    return 2
  }
  if !cascadeConverged {
    // Diagnostics may all be warnings (or empty) yet the cascade did
    // not settle — surface the failure as exit 2 so the warning above
    // is not lost in a shell `&& echo ok` pipeline.
    return 2
  }
  if opts.verbose && totalFixes > 0 {
    fmt.Fprintf(os.Stdout, "@ttsc/lint: fixed=%d edits\n", totalFixes)
  }
  return 0
}

// loadFixProgram loads the TypeScript program for a fix/format pass with
// NoEmit forced on. Returns (nil, 2) when loading or config parsing fails.
func loadFixProgram(opts *subcommandOpts) (*program, int) {
  prog, parseDiags, err := loadProgram(opts.cwd, opts.tsconfig, loadProgramOptions{
    forceNoEmit: true,
    outDir:      opts.outDir,
  })
  if err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: %v\n", err)
    return nil, 2
  }
  if len(parseDiags) > 0 {
    shimdw.FormatASTDiagnosticsWithColorAndContext(os.Stderr, parseDiags, opts.cwd)
    return nil, 2
  }
  return prog, 0
}

// reloadFixProgram closes `current` and loads a fresh program from disk.
// Used between cascade passes so the engine sees edits applied in the
// previous pass rather than stale in-memory AST nodes.
func reloadFixProgram(current *program, opts *subcommandOpts) (*program, int) {
  if current != nil {
    current.close()
  }
  return loadFixProgram(opts)
}

// fileFixes groups all pending TextEdit suggestions for a single file.
// `text` is the source content at the time the findings were collected;
// byte offsets in `edits` are relative to this snapshot.
type fileFixes struct {
  path  string
  text  string
  edits []TextEdit
}

// applyFindingFixes groups all fixable findings by file, resolves each
// file path to an absolute form, then applies the edit batches in
// deterministic order (sorted by path). Returns the total number of edits
// written to disk.
func applyFindingFixes(cwd string, findings []*Finding) (int, error) {
  byFile := map[string]*fileFixes{}
  for _, finding := range findings {
    if finding == nil || finding.File == nil || len(finding.Fix) == 0 {
      continue
    }
    path := finding.File.FileName()
    if path == "" {
      continue
    }
    if !filepath.IsAbs(path) {
      path = filepath.Join(cwd, path)
    }
    if abs, err := filepath.Abs(path); err == nil {
      path = abs
    }
    bucket := byFile[path]
    if bucket == nil {
      bucket = &fileFixes{path: path, text: finding.File.Text()}
      byFile[path] = bucket
    }
    bucket.edits = append(bucket.edits, finding.Fix...)
  }

  paths := make([]string, 0, len(byFile))
  for p := range byFile {
    paths = append(paths, p)
  }
  sort.Strings(paths)
  total := 0
  for _, p := range paths {
    bucket := byFile[p]
    fixed, err := applyTextEditsToFile(bucket.path, bucket.text, bucket.edits)
    if err != nil {
      return total, err
    }
    total += fixed
  }
  return total, nil
}

// applyTextEditsToFile selects the non-overlapping edits from `edits`, applies
// them to `source` in reverse order (right-to-left) to preserve earlier
// offsets, and writes the result to `path`. Returns the number of edits
// applied, or 0 when no edits survive selection.
func applyTextEditsToFile(path, source string, edits []TextEdit) (int, error) {
  selected := selectTextEdits(len(source), edits)
  if len(selected) == 0 {
    return 0, nil
  }
  next := source
  for i := len(selected) - 1; i >= 0; i-- {
    edit := selected[i]
    next = next[:edit.Pos] + edit.Text + next[edit.End:]
  }
  if next == source {
    return 0, nil
  }
  if err := os.WriteFile(path, []byte(next), 0o644); err != nil {
    return 0, fmt.Errorf("@ttsc/lint fix: write %s: %w", path, err)
  }
  return len(selected), nil
}

// selectTextEdits filters and sorts `edits` into a non-overlapping
// application sequence. Out-of-bounds edits and exact duplicates are
// removed first; the remainder is sorted by start position then end
// position (left to right). A greedy scan then keeps the earliest-starting
// edit and drops any that overlap with it, producing a disjoint set.
func selectTextEdits(sourceLen int, edits []TextEdit) []TextEdit {
  if len(edits) == 0 {
    return nil
  }
  sorted := make([]TextEdit, 0, len(edits))
  seen := map[TextEdit]struct{}{}
  for _, edit := range edits {
    if edit.Pos < 0 || edit.End < edit.Pos || edit.End > sourceLen {
      continue
    }
    if _, exists := seen[edit]; exists {
      continue
    }
    seen[edit] = struct{}{}
    sorted = append(sorted, edit)
  }
  sort.SliceStable(sorted, func(i, j int) bool {
    if sorted[i].Pos != sorted[j].Pos {
      return sorted[i].Pos < sorted[j].Pos
    }
    if sorted[i].End != sorted[j].End {
      return sorted[i].End < sorted[j].End
    }
    return sorted[i].Text < sorted[j].Text
  })

  selected := make([]TextEdit, 0, len(sorted))
  lastEnd := -1
  for _, edit := range sorted {
    if edit.Pos < lastEnd {
      continue
    }
    selected = append(selected, edit)
    lastEnd = edit.End
  }
  return selected
}
