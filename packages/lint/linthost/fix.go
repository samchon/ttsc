// Autofix orchestration for the `@ttsc/lint fix` subcommand.
//
// RunFix drives the fix cascade: it repeatedly runs the native lint engine
// and applies any emitted automatic TextEdit fixes until no more fixable
// findings remain or maxFixPasses is reached. After the cascade settles, it
// runs a final diagnostic pass so remaining issues are surfaced in the
// normal error stream.
package linthost

import (
  "fmt"
  "os"
  "path/filepath"
  "sort"

  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
)

// maxFixPasses bounds the native fix cascade. Real-world cascades (noVar →
// preferConst → eqeqeq …) settle in a handful of passes; the cap exists so
// a buggy rule that re-reports its own edit cannot loop forever.
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
  // `ttsc fix` runs lint autofixes AND format-rule edits in one pass. Formatting
  // is configured solely through the `format` block (a format/* key in `rules`
  // is dropped), so wrap the resolver in formatCommandResolver to force-activate
  // the format rules that block configured — the same promotion `ttsc format`
  // applies to a configured block.
  //
  // Deliberately NOT newFormatCommandResolver: fix supplies no defaultOptions, so
  // a project with no `format` block enables no format rules and fix stays a pure
  // lint pass. Loading the always-on default formatter is `ttsc format`'s job;
  // doing it here would reformat every file during a plain lint fix. This
  // divergence is the contract pinned by
  // command_fix_skips_default_formatting_that_format_applies_test.go and the
  // website lint docs.
  engine := NewEngineWithResolver(formatCommandResolver{inner: rules})
  if err := engine.ConfigError(); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  engine.SetSerial(opts.singleThreaded)
  needsRuleChecker := engine.NeedsTypeChecker()

  prog, code := loadFixProgram(opts, needsRuleChecker)
  if code != 0 {
    return code
  }
  defer func() {
    if prog != nil {
      prog.close()
    }
  }()

  totalFixes := 0

  // `ttsc fix` applies edits from BOTH lint-class rules and
  // format-class rules. The dual `ttsc format` subcommand exists for
  // the format-only path; fix is the "run everything" entry point so
  // users don't have to chain two invocations. The engine emits both
  // kinds of findings in one pass — no filtering needed here.
  cascadeConverged := false
  for pass := 0; pass < maxFixPasses; pass++ {
    findings := prog.runLintCycle(engine)
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
    prog, code = reloadFixProgram(prog, opts, needsRuleChecker)
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

  astDiags, lintDiags, err := collectDiagnostics(prog, engine)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  warnUnknownRules(os.Stderr, engine.UnknownRules())
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
func loadFixProgram(opts *subcommandOpts, needsRuleChecker bool) (*program, int) {
  prog, parseDiags, err := loadProgram(opts.cwd, opts.tsconfig, loadProgramOptions{
    forceNoEmit:      true,
    outDir:           opts.outDir,
    needsRuleChecker: needsRuleChecker,
    singleThreaded:   opts.singleThreaded,
    checkers:         opts.checkers,
    tsgoArgs:         opts.tsgoArgs,
    projectIdentity:  opts.projectIdentity,
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
func reloadFixProgram(current *program, opts *subcommandOpts, needsRuleChecker bool) (*program, int) {
  if current != nil {
    current.close()
  }
  return loadFixProgram(opts, needsRuleChecker)
}

// fileFixes groups all pending automatic TextEdit fixes for a single file,
// one edit group per finding so a multi-edit atomic fix stays all-or-nothing
// during selection. `text` is the source content at the time the findings were
// collected; byte offsets in `groups` are relative to this snapshot.
type fileFixes struct {
  path   string
  text   string
  groups [][]TextEdit
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
    bucket.groups = append(bucket.groups, finding.Fix)
  }

  paths := make([]string, 0, len(byFile))
  for p := range byFile {
    paths = append(paths, p)
  }
  sort.Strings(paths)
  total := 0
  for _, p := range paths {
    bucket := byFile[p]
    fixed, err := applyTextEditsToFile(bucket.path, bucket.text, bucket.groups)
    if err != nil {
      return total, err
    }
    total += fixed
  }
  return total, nil
}

// applyTextEditsToFile selects a non-overlapping, per-finding-atomic set of
// edits from `groups` (one group per finding), applies them to `source` in
// reverse order (right-to-left) to preserve earlier offsets, and writes the
// result to `path`. Returns the number of edits applied, or 0 when no edits
// survive selection.
func applyTextEditsToFile(path, source string, groups [][]TextEdit) (int, error) {
  selected := selectTextEditGroups(len(source), groups)
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
  // lastInsertAt marks the offset of the previously-selected edit when that
  // edit was a zero-width insert (Pos==End), else -1. A new zero-width
  // insert at that same offset must be dropped: two coincident inserts both
  // pass the `edit.Pos < lastEnd` gate, then apply in reverse sort order and
  // concatenate at one point — silently corrupting the source (e.g. a `;`
  // insert and a `\n` insert at EOF yielding `\n;`). The host contract keeps
  // one winner and drops the rest (see rule.TextEdit). A zero-width insert
  // sitting at the end of a prior NON-empty edit is left alone: it applies
  // cleanly after the replacement and is a legitimate adjacency.
  lastInsertAt := -1
  for _, edit := range sorted {
    if edit.Pos < lastEnd {
      continue
    }
    if edit.Pos == edit.End && edit.Pos == lastInsertAt {
      continue
    }
    selected = append(selected, edit)
    lastEnd = edit.End
    if edit.Pos == edit.End {
      lastInsertAt = edit.Pos
    } else {
      lastInsertAt = -1
    }
  }
  return selected
}

// selectTextEditGroups selects a non-overlapping application sequence from
// per-finding edit GROUPS, applying each group all-or-nothing. Unlike
// selectTextEdits, which resolves conflicts edit-by-edit, this keeps a
// finding's multi-edit fix atomic: a fix such as noImportTypeSideEffects emits
// an `import type` insert paired with an inline `type` deletion, and applying
// only one member emits invalid code (`import type { type A }`). Groups are
// considered earliest-edit-first, and a group is accepted only when every one
// of its edits coexists — under the same disjointness rules as selectTextEdits
// — with the edits already accepted from earlier groups. If any member would be
// dropped (it overlaps an already-selected group, duplicates an already-
// selected edit, is a coincident zero-width insert, or is out of bounds), the
// WHOLE group is skipped so the owning finding re-fires on the next cascade
// pass rather than half-applying (samchon/ttsc#605).
func selectTextEditGroups(sourceLen int, groups [][]TextEdit) []TextEdit {
  order := make([]int, 0, len(groups))
  for i := range groups {
    if len(groups[i]) > 0 {
      order = append(order, i)
    }
  }
  sort.SliceStable(order, func(a, b int) bool {
    return textEditGroupLess(groups[order[a]], groups[order[b]])
  })
  selected := make([]TextEdit, 0)
  for _, index := range order {
    group := dedupeTextEdits(groups[index])
    candidate := make([]TextEdit, 0, len(selected)+len(group))
    candidate = append(candidate, selected...)
    candidate = append(candidate, group...)
    kept := selectTextEdits(sourceLen, candidate)
    // Accept the group only if nothing was dropped: a shorter result means one
    // of its edits collided with an already-selected edit (or a sibling edit of
    // its own group), so the group cannot apply atomically here.
    if len(kept) == len(candidate) {
      selected = kept
    }
  }
  return selected
}

// dedupeTextEdits removes exact-duplicate edits while preserving order. A
// finding that emits the same edit twice still applies its distinct edits;
// deduping here keeps such a finding from being rejected as "internally
// inconsistent" by selectTextEditGroups, since an exact duplicate is not a
// conflict the way an overlap is.
func dedupeTextEdits(edits []TextEdit) []TextEdit {
  if len(edits) == 0 {
    return nil
  }
  seen := make(map[TextEdit]struct{}, len(edits))
  out := make([]TextEdit, 0, len(edits))
  for _, edit := range edits {
    if _, ok := seen[edit]; ok {
      continue
    }
    seen[edit] = struct{}{}
    out = append(out, edit)
  }
  return out
}

// textEditGroupLess orders edit groups by their earliest member under the same
// (Pos, End, Text) key selectTextEdits sorts by, so selection is deterministic
// and the earliest-starting finding wins a contested range.
func textEditGroupLess(a, b []TextEdit) bool {
  ea, eb := minTextEdit(a), minTextEdit(b)
  if ea.Pos != eb.Pos {
    return ea.Pos < eb.Pos
  }
  if ea.End != eb.End {
    return ea.End < eb.End
  }
  return ea.Text < eb.Text
}

// minTextEdit returns the least edit of a non-empty group under the
// (Pos, End, Text) order. Panics on an empty slice; callers filter empties out.
func minTextEdit(edits []TextEdit) TextEdit {
  least := edits[0]
  for _, edit := range edits[1:] {
    if textEditLess(edit, least) {
      least = edit
    }
  }
  return least
}

func textEditLess(a, b TextEdit) bool {
  if a.Pos != b.Pos {
    return a.Pos < b.Pos
  }
  if a.End != b.End {
    return a.End < b.End
  }
  return a.Text < b.Text
}
