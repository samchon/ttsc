package linthost

import (
  "crypto/sha256"
  "encoding/json"
  "errors"
  "flag"
  "fmt"
  "io"
  "io/fs"
  "net/url"
  "os"
  "path/filepath"
  "strings"
  "unicode/utf16"
  "unicode/utf8"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
)

const (
  commandLintFixAll          = "ttsc.lint.fixAll"
  commandLintApplySuggestion = "ttsc.lint.applySuggestion"
  commandFormatDocument      = "ttsc.format.document"
)

type lspPosition struct {
  Line      int `json:"line"`
  Character int `json:"character"`
}

type lspRange struct {
  Start lspPosition `json:"start"`
  End   lspPosition `json:"end"`
}

type lspPositionWire struct {
  Line      *int `json:"line"`
  Character *int `json:"character"`
}

type lspRangeWire struct {
  Start *lspPositionWire `json:"start"`
  End   *lspPositionWire `json:"end"`
}

type lspDiagnostic struct {
  Range    lspRange `json:"range"`
  Severity int      `json:"severity,omitempty"`
  Code     string   `json:"code,omitempty"`
  Source   string   `json:"source,omitempty"`
  Message  string   `json:"message"`
}

type lspCommand struct {
  Title     string            `json:"title"`
  Command   string            `json:"command"`
  Arguments []json.RawMessage `json:"arguments,omitempty"`
}

type lspCodeAction struct {
  Title       string      `json:"title"`
  Kind        string      `json:"kind,omitempty"`
  Command     *lspCommand `json:"command,omitempty"`
  IsPreferred bool        `json:"isPreferred,omitempty"`
}

type lspCodeActionContextWire struct {
  Only []string `json:"only,omitempty"`
}

type lspTextEdit struct {
  Range   lspRange `json:"range"`
  NewText string   `json:"newText"`
}

type lspWorkspaceEdit struct {
  Changes map[string][]lspTextEdit `json:"changes,omitempty"`
}

type lspSuggestionSelection struct {
  Rule            string `json:"rule"`
  Message         string `json:"message"`
  Pos             int    `json:"pos"`
  End             int    `json:"end"`
  SuggestionIndex int    `json:"suggestionIndex"`
  Title           string `json:"title"`
  SourceHash      string `json:"sourceHash"`
  Fingerprint     string `json:"fingerprint"`
}

type lspCommandOptions struct {
  argumentsJSON string
  command       string
  contextJSON   string
  // contentStdin reports whether the caller passed --content-stdin. When
  // set, RunLSPExecuteCommand reads the FULL document buffer from os.Stdin
  // (to EOF) and formats that text in memory instead of reading the target
  // file from disk. See lspFormatBuffer.
  contentStdin bool
  cwd          string
  pluginsJSON  string
  // rangeJSON carries the editor selection used to limit quickfix.ttsc
  // actions. Source fix-all and format actions remain document-wide.
  rangeJSON string
  tsconfig  string
  uri       string
}

// RunLSPCommandIDs prints the workspace/executeCommand ids owned by @ttsc/lint.
func RunLSPCommandIDs([]string) int {
  return writeJSON([]string{
    commandLintFixAll,
    commandLintApplySuggestion,
    commandFormatDocument,
  })
}

// RunLSPCodeActionKinds prints the CodeActionKind values @ttsc/lint may return.
func RunLSPCodeActionKinds([]string) int {
  return writeJSON([]string{"quickfix.ttsc", "source.fixAll.ttsc", "source.format"})
}

// RunLSPDiagnostics prints lint diagnostics for one file URI as LSP JSON.
func RunLSPDiagnostics(args []string) int {
  opts, ok := parseLSPCommandOptions("lsp-diagnostics", args)
  if !ok {
    return 2
  }
  findings, _, closeProgram, code := lspFindings(opts, false)
  if closeProgram != nil {
    defer closeProgram()
  }
  if code != 0 {
    return code
  }
  diagnostics := make([]lspDiagnostic, 0, len(findings))
  for _, finding := range findings {
    diagnostics = append(diagnostics, findingToLSPDiagnostic(finding))
  }
  return writeJSON(diagnostics)
}

// RunLSPCodeActions prints code actions available for one file URI/range.
func RunLSPCodeActions(args []string) int {
  opts, ok := parseLSPCommandOptions("lsp-code-actions", args)
  if !ok {
    return 2
  }
  acceptsLint := acceptsActionKind(opts.contextJSON, "source.fixAll.ttsc")
  acceptsQuickFix := acceptsActionKind(opts.contextJSON, "quickfix.ttsc")
  acceptsFormat := acceptsActionKind(opts.contextJSON, "source.format")
  quickFixRange, quickFixRangeOK := parseRequestedLSPRange(opts.rangeJSON)
  if acceptsQuickFix && !quickFixRangeOK {
    acceptsQuickFix = false
  }
  if !acceptsLint && !acceptsQuickFix && !acceptsFormat {
    return writeJSON([]lspCodeAction{})
  }
  if lspProjectTargetHasSegment(opts, "node_modules") {
    return writeJSON([]lspCodeAction{})
  }
  if lspProjectTargetOutsideCwd(opts) {
    return writeJSON([]lspCodeAction{})
  }
  findings, _, closeProgram, code := lspFindings(opts, acceptsFormat)
  if closeProgram != nil {
    defer closeProgram()
  }
  if code != 0 {
    return code
  }
  lintFindings := filterLintFindings(findings)
  formatFindings := filterFormatFindings(findings)
  var actions []lspCodeAction
  if acceptsQuickFix {
    actions = append(actions, lspSuggestionCodeActions(opts, lintFindings, quickFixRange)...)
  }
  if acceptsLint && hasFixableFinding(lintFindings) {
    uriArg, _ := json.Marshal(opts.uri)
    actions = append(actions, lspCodeAction{
      Title:       "Fix all ttsc lint issues",
      Kind:        "source.fixAll.ttsc",
      IsPreferred: true,
      Command: &lspCommand{
        Title:     "Fix all ttsc lint issues",
        Command:   commandLintFixAll,
        Arguments: []json.RawMessage{uriArg},
      },
    })
  }
  if acceptsFormat && hasFormatFinding(formatFindings) {
    uriArg, _ := json.Marshal(opts.uri)
    actions = append(actions, lspCodeAction{
      Title: "Format document with ttsc",
      Kind:  "source.format",
      Command: &lspCommand{
        Title:     "Format document with ttsc",
        Command:   commandFormatDocument,
        Arguments: []json.RawMessage{uriArg},
      },
    })
  }
  return writeJSON(actions)
}

// RunLSPExecuteCommand returns a WorkspaceEdit for a lint-owned command.
func RunLSPExecuteCommand(args []string) int {
  opts, ok := parseLSPCommandOptions("lsp-execute-command", args)
  if !ok {
    return 2
  }
  if opts.command != commandLintFixAll &&
    opts.command != commandLintApplySuggestion &&
    opts.command != commandFormatDocument {
    fmt.Fprintf(os.Stderr, "@ttsc/lint lsp-execute-command: unknown command %q\n", opts.command)
    return 2
  }
  uri, err := firstURIArgument(opts.argumentsJSON)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  opts.uri = uri
  if opts.command == commandLintApplySuggestion {
    edit, code := lspWorkspaceEditForSuggestion(opts)
    if code != 0 {
      return code
    }
    return writeJSON(edit)
  }
  // --content-stdin selects the lightweight in-memory format path: the full
  // document buffer is read from stdin and formatted with AST+source rules
  // only, with no temp-workspace copy and no tsgo Program. It applies to
  // ttsc.format.document; ttsc.lint.fixAll under --content-stdin is out of
  // scope (lint-class fixes can require a type checker), so it falls back to
  // the disk-based path below.
  if opts.contentStdin && opts.command == commandFormatDocument {
    content, err := io.ReadAll(os.Stdin)
    if err != nil {
      fmt.Fprintf(os.Stderr, "@ttsc/lint lsp-execute-command: read --content-stdin: %v\n", err)
      return 2
    }
    edit, code := lspFormatBuffer(string(content), opts)
    if code != 0 {
      return code
    }
    return writeJSON(edit)
  }
  edit, code := lspWorkspaceEditForCommand(opts)
  if code != 0 {
    return code
  }
  return writeJSON(edit)
}

func parseLSPCommandOptions(name string, args []string) (*lspCommandOptions, bool) {
  fs := flag.NewFlagSet(name, flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
  cwd := fs.String("cwd", "", "")
  tsconfig := fs.String("tsconfig", "tsconfig.json", "")
  pluginsJSON := fs.String("plugins-json", "", "")
  uri := fs.String("uri", "", "")
  rangeJSON := fs.String("range-json", "", "")
  contextJSON := fs.String("context-json", "", "")
  command := fs.String("command", "", "")
  argumentsJSON := fs.String("arguments-json", "", "")
  contentStdin := fs.Bool("content-stdin", false, "")
  if err := fs.Parse(args); err != nil {
    return nil, false
  }
  resolvedCwd, err := resolveCwd(*cwd)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, false
  }
  return &lspCommandOptions{
    argumentsJSON: *argumentsJSON,
    command:       *command,
    contextJSON:   *contextJSON,
    contentStdin:  *contentStdin,
    cwd:           resolvedCwd,
    pluginsJSON:   *pluginsJSON,
    rangeJSON:     *rangeJSON,
    tsconfig:      *tsconfig,
    uri:           *uri,
  }, true
}

func lspFindings(opts *lspCommandOptions, includeFormatDefaults bool) ([]*Finding, *program, func(), int) {
  if opts.uri == "" {
    fmt.Fprintln(os.Stderr, "@ttsc/lint: lsp command requires --uri")
    return nil, nil, nil, 2
  }
  target, err := filePathFromURI(opts.uri)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, nil, nil, 2
  }
  rules, err := loadRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, nil, nil, 2
  }
  if includeFormatDefaults {
    rules = formatCommandResolver{inner: rules}
  }
  engine := NewEngineWithResolver(rules)
  prog, parseDiags, err := loadProgram(opts.cwd, opts.tsconfig, loadProgramOptions{
    forceNoEmit:      true,
    needsRuleChecker: engine.NeedsTypeChecker(),
  })
  if err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: %v\n", err)
    return nil, nil, nil, 2
  }
  if len(parseDiags) > 0 {
    // tsgo already owns parse diagnostics in the upstream LSP process.
    return nil, prog, prog.close, 0
  }
  findings := filterFindingsForPath(engine.Run(prog.userSourceFiles(), prog.checker), target)
  return findings, prog, prog.close, 0
}

func filterFindingsForPath(findings []*Finding, target string) []*Finding {
  target = canonicalProjectPath("", target)
  out := make([]*Finding, 0, len(findings))
  for _, finding := range findings {
    if finding == nil || finding.File == nil {
      continue
    }
    if canonicalProjectPath("", finding.File.FileName()) == target {
      out = append(out, finding)
    }
  }
  return out
}

func findingToLSPDiagnostic(finding *Finding) lspDiagnostic {
  return lspDiagnostic{
    Range:    lspRangeForFinding(finding),
    Severity: lspSeverity(finding.Severity),
    Code:     finding.Rule,
    Source:   "@ttsc/lint",
    Message:  finding.Message,
  }
}

func lspRangeForFinding(finding *Finding) lspRange {
  text := ""
  if finding != nil && finding.File != nil {
    text = finding.File.Text()
  }
  return lspRange{
    Start: byteOffsetToLSPPosition(text, finding.Pos),
    End:   byteOffsetToLSPPosition(text, finding.End),
  }
}

func lspSeverity(severity Severity) int {
  if severity == SeverityError {
    return 1
  }
  return 2
}

func hasFixableFinding(findings []*Finding) bool {
  for _, finding := range findings {
    if finding != nil && len(finding.Fix) > 0 {
      return true
    }
  }
  return false
}

func hasFormatFinding(findings []*Finding) bool {
  for _, finding := range findings {
    if finding != nil && finding.IsFormat && len(finding.Fix) > 0 {
      return true
    }
  }
  return false
}

func filterLintFindings(findings []*Finding) []*Finding {
  out := make([]*Finding, 0, len(findings))
  for _, finding := range findings {
    if finding != nil && !finding.IsFormat {
      out = append(out, finding)
    }
  }
  return out
}

func acceptsActionKind(raw string, kind string) bool {
  var ctx lspCodeActionContextWire
  if strings.TrimSpace(raw) == "" || json.Unmarshal([]byte(raw), &ctx) != nil || len(ctx.Only) == 0 {
    return true
  }
  for _, only := range ctx.Only {
    if only == kind || strings.HasPrefix(kind, only+".") {
      return true
    }
  }
  return false
}

func lspSuggestionCodeActions(
  opts *lspCommandOptions,
  findings []*Finding,
  requestedRange lspRange,
) []lspCodeAction {
  actions := make([]lspCodeAction, 0)
  sourceHashes := make(map[*shimast.SourceFile]string)
  for _, finding := range findings {
    if finding == nil || finding.File == nil || len(finding.Suggestions) == 0 {
      continue
    }
    if !lspRangesOverlap(requestedRange, lspRangeForFinding(finding)) {
      continue
    }
    sourceHash, ok := sourceHashes[finding.File]
    if !ok {
      sourceHash = lspSourceHash(finding.File.Text())
      sourceHashes[finding.File] = sourceHash
    }
    for index, suggestion := range finding.Suggestions {
      if suggestion.Title == "" || len(suggestion.Edits) == 0 {
        continue
      }
      uriArg, err := json.Marshal(opts.uri)
      if err != nil {
        continue
      }
      selectionArg, err := json.Marshal(lspSuggestionSelection{
        Rule:            finding.Rule,
        Message:         finding.Message,
        Pos:             finding.Pos,
        End:             finding.End,
        SuggestionIndex: index,
        Title:           suggestion.Title,
        SourceHash:      sourceHash,
        Fingerprint:     lspSuggestionFingerprint(finding, suggestion),
      })
      if err != nil {
        continue
      }
      actions = append(actions, lspCodeAction{
        Title: suggestion.Title,
        Kind:  "quickfix.ttsc",
        Command: &lspCommand{
          Title:     suggestion.Title,
          Command:   commandLintApplySuggestion,
          Arguments: []json.RawMessage{uriArg, selectionArg},
        },
      })
    }
  }
  return actions
}

func parseRequestedLSPRange(raw string) (lspRange, bool) {
  var wire lspRangeWire
  if strings.TrimSpace(raw) == "" || json.Unmarshal([]byte(raw), &wire) != nil ||
    wire.Start == nil || wire.End == nil ||
    wire.Start.Line == nil || wire.Start.Character == nil ||
    wire.End.Line == nil || wire.End.Character == nil {
    return lspRange{}, false
  }
  requested := lspRange{
    Start: lspPosition{Line: *wire.Start.Line, Character: *wire.Start.Character},
    End:   lspPosition{Line: *wire.End.Line, Character: *wire.End.Character},
  }
  if requested.Start.Line < 0 || requested.Start.Character < 0 ||
    requested.End.Line < 0 || requested.End.Character < 0 ||
    compareLSPPositions(requested.Start, requested.End) > 0 {
    return lspRange{}, false
  }
  return requested, true
}

func lspRangesOverlap(left lspRange, right lspRange) bool {
  if compareLSPPositions(left.Start, left.End) == 0 {
    return compareLSPPositions(left.Start, right.Start) >= 0 &&
      compareLSPPositions(left.Start, right.End) < 0
  }
  if compareLSPPositions(right.Start, right.End) == 0 {
    return compareLSPPositions(right.Start, left.Start) >= 0 &&
      compareLSPPositions(right.Start, left.End) < 0
  }
  return compareLSPPositions(left.Start, right.End) < 0 &&
    compareLSPPositions(right.Start, left.End) < 0
}

func compareLSPPositions(left lspPosition, right lspPosition) int {
  if left.Line < right.Line {
    return -1
  }
  if left.Line > right.Line {
    return 1
  }
  if left.Character < right.Character {
    return -1
  }
  if left.Character > right.Character {
    return 1
  }
  return 0
}

func lspSourceHash(source string) string {
  return fmt.Sprintf("%x", sha256.Sum256([]byte(source)))
}

func lspSuggestionFingerprint(finding *Finding, suggestion Suggestion) string {
  payload, _ := json.Marshal(struct {
    Rule    string     `json:"rule"`
    Message string     `json:"message"`
    Pos     int        `json:"pos"`
    End     int        `json:"end"`
    Title   string     `json:"title"`
    Edits   []TextEdit `json:"edits"`
  }{
    Rule:    finding.Rule,
    Message: finding.Message,
    Pos:     finding.Pos,
    End:     finding.End,
    Title:   suggestion.Title,
    Edits:   suggestion.Edits,
  })
  return fmt.Sprintf("%x", sha256.Sum256(payload))
}

func lspWorkspaceEditForSuggestion(opts *lspCommandOptions) (*lspWorkspaceEdit, int) {
  target, err := filePathFromURI(opts.uri)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  if _, ok := projectRelativePath(opts.cwd, target); !ok {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: LSP command target %s is outside cwd %s\n", target, opts.cwd)
    return nil, 2
  }
  if projectPathHasSegment(opts.cwd, target, "node_modules") {
    return nil, 0
  }
  selection, err := suggestionSelectionArgument(opts.argumentsJSON)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  current, err := os.ReadFile(target)
  if err != nil || lspSourceHash(string(current)) != selection.SourceHash {
    return nil, 0
  }
  findings, _, closeProgram, code := lspFindings(opts, false)
  if closeProgram != nil {
    defer closeProgram()
  }
  if code != 0 {
    return nil, code
  }
  for _, finding := range findings {
    if finding == nil || finding.Rule != selection.Rule ||
      finding.Message != selection.Message ||
      finding.Pos != selection.Pos || finding.End != selection.End ||
      selection.SuggestionIndex >= len(finding.Suggestions) {
      continue
    }
    suggestion := finding.Suggestions[selection.SuggestionIndex]
    if suggestion.Title != selection.Title || finding.File == nil ||
      lspSourceHash(finding.File.Text()) != selection.SourceHash ||
      lspSuggestionFingerprint(finding, suggestion) != selection.Fingerprint {
      continue
    }
    source := finding.File.Text()
    selected := selectTextEdits(len(source), suggestion.Edits)
    if len(selected) == 0 || len(selected) != len(suggestion.Edits) {
      return nil, 0
    }
    edits := make([]lspTextEdit, 0, len(selected))
    for _, edit := range selected {
      edits = append(edits, lspTextEdit{
        Range: lspRange{
          Start: byteOffsetToLSPPosition(source, edit.Pos),
          End:   byteOffsetToLSPPosition(source, edit.End),
        },
        NewText: edit.Text,
      })
    }
    current, err := os.ReadFile(target)
    if err != nil || lspSourceHash(string(current)) != selection.SourceHash {
      return nil, 0
    }
    return &lspWorkspaceEdit{Changes: map[string][]lspTextEdit{opts.uri: edits}}, 0
  }
  return nil, 0
}

func suggestionSelectionArgument(raw string) (lspSuggestionSelection, error) {
  var args []json.RawMessage
  if strings.TrimSpace(raw) == "" || json.Unmarshal([]byte(raw), &args) != nil || len(args) < 2 {
    return lspSuggestionSelection{}, errors.New("@ttsc/lint lsp-execute-command: missing suggestion selection argument")
  }
  var selection lspSuggestionSelection
  if err := json.Unmarshal(args[1], &selection); err != nil {
    return lspSuggestionSelection{}, fmt.Errorf("@ttsc/lint lsp-execute-command: invalid suggestion selection: %w", err)
  }
  if selection.Rule == "" || selection.Message == "" || selection.Title == "" ||
    len(selection.SourceHash) != sha256.Size*2 ||
    len(selection.Fingerprint) != sha256.Size*2 ||
    selection.Pos < 0 || selection.End < selection.Pos || selection.SuggestionIndex < 0 {
    return lspSuggestionSelection{}, errors.New("@ttsc/lint lsp-execute-command: invalid suggestion selection")
  }
  return selection, nil
}

func lspWorkspaceEditForCommand(opts *lspCommandOptions) (*lspWorkspaceEdit, int) {
  target, err := filePathFromURI(opts.uri)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  if _, ok := projectRelativePath(opts.cwd, target); !ok {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: LSP command target %s is outside cwd %s\n", target, opts.cwd)
    return nil, 2
  }
  if projectPathHasSegment(opts.cwd, target, "node_modules") {
    return nil, 0
  }
  original, err := os.ReadFile(target)
  if err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: read %s: %v\n", target, err)
    return nil, 2
  }
  tempRoot, tempTarget, tempTsconfig, cleanup, err := prepareLSPCommandWorkspace(opts.cwd, opts.tsconfig, target)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  defer cleanup()

  pluginsJSON := remapLSPPluginsJSONForTempWorkspace(opts.pluginsJSON, opts.cwd, tempRoot)
  rules, err := loadRules(pluginsJSON, tempRoot, tempTsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  if opts.command == commandFormatDocument {
    rules = formatCommandResolver{inner: rules}
  }
  engine := NewEngineWithResolver(rules)
  needsRuleChecker := engine.NeedsTypeChecker()
  maxPasses := maxFixPasses
  if opts.command == commandFormatDocument {
    maxPasses = maxFormatPasses
  }
  converged := false
  for pass := 0; pass < maxPasses; pass++ {
    prog, parseDiags, err := loadProgram(tempRoot, tempTsconfig, loadProgramOptions{
      forceNoEmit:      true,
      needsRuleChecker: needsRuleChecker,
    })
    if err != nil {
      fmt.Fprintf(os.Stderr, "@ttsc/lint: %v\n", err)
      return nil, 2
    }
    if len(parseDiags) > 0 {
      prog.close()
      return nil, 0
    }
    findings := filterFindingsForPath(engine.Run(prog.userSourceFiles(), prog.checker), tempTarget)
    prog.close()
    if opts.command == commandFormatDocument {
      findings = filterFormatFindings(findings)
    } else {
      findings = filterLintFindings(findings)
    }
    fixed, err := applyFindingFixes(tempRoot, findings)
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      return nil, 3
    }
    if fixed == 0 {
      converged = true
      break
    }
  }
  if !converged {
    fmt.Fprintf(os.Stderr,
      "@ttsc/lint: LSP %s cascade did not converge after %d passes\n",
      opts.command, maxPasses)
    return nil, 2
  }
  next, err := os.ReadFile(tempTarget)
  if err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: read cascaded %s: %v\n", tempTarget, err)
    return nil, 2
  }
  return workspaceEditForFullDocument(opts.uri, string(original), string(next)), 0
}

// lspFormatBuffer formats an in-memory document buffer using only the
// format-class rules, with no tsgo Program and no temp-workspace copy. It is
// the lightweight path behind --content-stdin for ttsc.format.document.
//
// Format rules are AST+source only (`IsFormat() == true`); none implement
// typeAwareRule, so the engine runs them with a nil checker. The document
// content comes entirely from `content` — the file on disk at opts.uri is
// never read — so an editor can format an unsaved buffer without paying the
// disk-copy + full-program-load cost of lspWorkspaceEditForCommand.
//
// Returns the same WorkspaceEdit shape as the disk path, or (nil, 0) on a
// no-op (no fixable findings, or text unchanged after convergence).
func lspFormatBuffer(content string, opts *lspCommandOptions) (*lspWorkspaceEdit, int) {
  target, err := filePathFromURI(opts.uri)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  // Guard rails mirror lspWorkspaceEditForCommand: skip targets outside the
  // project root or inside node_modules.
  if _, ok := projectRelativePath(opts.cwd, target); !ok {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: LSP command target %s is outside cwd %s\n", target, opts.cwd)
    return nil, 2
  }
  if projectPathHasSegment(opts.cwd, target, "node_modules") {
    return nil, 0
  }

  rules, err := loadFormatRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  resolver, err := newFormatCommandResolver(rules, filepath.Dir(target), vscodeLanguageID(target))
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  engine := NewEngineWithResolver(resolver)
  if engine.NeedsTypeChecker() {
    // A format-class contributor rule (formatContributorAdapter) needs the type
    // checker, which the single-file in-memory parse can't supply. Fall back to
    // the disk path, which builds a full program with a checker, so the result
    // matches `ttsc format`; the dirty buffer can't be honored for these rules.
    // Built-in format rules are AST-only, so they keep the fast in-memory path.
    return lspWorkspaceEditForCommand(opts)
  }
  scriptKind := scriptKindForPath(target)

  text := content
  converged := false
  // The tsgo parser asserts on normalized (forward-slash) absolute paths;
  // `target` comes from filepath.Abs and carries backslashes on Windows.
  parseName := filepath.ToSlash(target)
  for pass := 0; pass < maxFormatPasses; pass++ {
    file := shimparser.ParseSourceFile(shimast.SourceFileParseOptions{FileName: parseName}, text, scriptKind)
    if file == nil {
      // Match the disk path: a buffer we can't parse is a benign no-op, not a
      // hard error — don't fight the editor's own diagnostics on a dirty buffer.
      return nil, 0
    }
    findings := filterFormatFindings(engine.Run([]*shimast.SourceFile{file}, nil))
    next, applied := applyFindingFixesToText(text, findings)
    if applied == 0 {
      converged = true
      break
    }
    text = next
  }
  if !converged {
    fmt.Fprintf(os.Stderr,
      "@ttsc/lint: LSP %s cascade did not converge after %d passes\n",
      opts.command, maxFormatPasses)
    return nil, 2
  }
  return workspaceEditForFullDocument(opts.uri, content, text), 0
}

// scriptKindForPath maps a file extension to the tsgo ScriptKind the parser
// needs so TS/JSX-only syntax is recognized. Mirrors the test helpers'
// ScriptKind selection (helpers_test.go parseTSFile/parseTSXFile).
func scriptKindForPath(path string) shimcore.ScriptKind {
  switch strings.ToLower(filepath.Ext(path)) {
  case ".tsx":
    return shimcore.ScriptKindTSX
  case ".jsx":
    return shimcore.ScriptKindJSX
  case ".js", ".cjs", ".mjs":
    return shimcore.ScriptKindJS
  default:
    return shimcore.ScriptKindTS
  }
}

// applyFindingFixesToText is the in-memory counterpart of
// applyFindingFixes/applyTextEditsToFile (fix.go): it collects every fixable
// finding's TextEdit, selects a non-overlapping set with the same
// selectTextEdits logic, applies them right-to-left to `text`, and returns the
// new string plus the number of edits applied. It never writes to disk and
// never reloads a Program. Findings carry byte offsets into the same `text`
// that was just parsed, so no per-file grouping is needed.
func applyFindingFixesToText(text string, findings []*Finding) (string, int) {
  edits := make([]TextEdit, 0, len(findings))
  for _, finding := range findings {
    if finding == nil || len(finding.Fix) == 0 {
      continue
    }
    edits = append(edits, finding.Fix...)
  }
  selected := selectTextEdits(len(text), edits)
  if len(selected) == 0 {
    return text, 0
  }
  next := text
  for i := len(selected) - 1; i >= 0; i-- {
    edit := selected[i]
    next = next[:edit.Pos] + edit.Text + next[edit.End:]
  }
  if next == text {
    return text, 0
  }
  return next, len(selected)
}

func workspaceEditForFullDocument(uri string, original string, next string) *lspWorkspaceEdit {
  if original == next {
    return nil
  }
  return &lspWorkspaceEdit{Changes: map[string][]lspTextEdit{uri: {{
    Range: lspRange{
      Start: lspPosition{Line: 0, Character: 0},
      End:   byteOffsetToLSPPosition(original, len(original)),
    },
    NewText: next,
  }}}}
}

func prepareLSPCommandWorkspace(cwd string, tsconfig string, target string) (string, string, string, func(), error) {
  tempRoot, err := os.MkdirTemp("", "ttsc-lint-lsp-")
  if err != nil {
    return "", "", "", nil, fmt.Errorf("@ttsc/lint: create LSP temp workspace: %w", err)
  }
  cleanup := func() { _ = os.RemoveAll(tempRoot) }
  if _, ok := tempPathFor(cwd, tempRoot, target); !ok {
    cleanup()
    return "", "", "", nil, fmt.Errorf("@ttsc/lint: LSP command target %s is outside cwd %s", target, cwd)
  }
  if err := copyLSPCommandWorkspace(cwd, tempRoot); err != nil {
    cleanup()
    return "", "", "", nil, err
  }
  if err := linkNearestNodeModules(tempRoot, cwd); err != nil {
    cleanup()
    return "", "", "", nil, err
  }
  tempTarget, _ := tempPathFor(cwd, tempRoot, target)
  tempTsconfig := tsconfig
  if filepath.IsAbs(tsconfig) {
    if mapped, ok := tempPathFor(cwd, tempRoot, tsconfig); ok {
      tempTsconfig = mapped
    }
  }
  return tempRoot, tempTarget, tempTsconfig, cleanup, nil
}

func copyLSPCommandWorkspace(src string, dst string) error {
  seenDirs := map[string]struct{}{}
  return filepath.WalkDir(src, func(current string, entry fs.DirEntry, walkErr error) error {
    if walkErr != nil {
      return walkErr
    }
    if current == src {
      return nil
    }
    rel, err := filepath.Rel(src, current)
    if err != nil {
      return err
    }
    if shouldSkipLSPCommandWorkspaceDir(entry.Name()) {
      if entry.IsDir() {
        return filepath.SkipDir
      }
      if entry.Type()&fs.ModeSymlink != 0 {
        return nil
      }
    }
    return copyLSPCommandWorkspaceEntry(current, filepath.Join(dst, rel), seenDirs)
  })
}

func copyLSPCommandWorkspaceEntry(src string, dst string, seenDirs map[string]struct{}) error {
  info, err := os.Stat(src)
  if err != nil {
    return err
  }
  mode := info.Mode()
  if info.IsDir() {
    linkInfo, err := os.Lstat(src)
    if err != nil {
      return err
    }
    isSymlink := linkInfo.Mode()&os.ModeSymlink != 0
    if isSymlink {
      realDir, err := filepath.EvalSymlinks(src)
      if err == nil {
        if _, ok := seenDirs[realDir]; ok {
          return nil
        }
        // Track the real path only for the active recursion branch.
        // Releasing it on return lets sibling aliases pointing at the
        // same real directory (e.g. `src-a -> real-src` and
        // `src-b -> real-src` in different tsconfig entries) each get
        // materialized; the test
        // `TestLSPExecuteCommandMaterializesDuplicateSymlinkedDirectories`
        // pins this contract.
        seenDirs[realDir] = struct{}{}
        defer delete(seenDirs, realDir)
      }
    }
    if err := os.MkdirAll(dst, mode.Perm()); err != nil {
      return err
    }
    if !isSymlink {
      return nil
    }
    entries, err := os.ReadDir(src)
    if err != nil {
      return err
    }
    for _, entry := range entries {
      if shouldSkipLSPCommandWorkspaceDir(entry.Name()) {
        continue
      }
      if err := copyLSPCommandWorkspaceEntry(
        filepath.Join(src, entry.Name()),
        filepath.Join(dst, entry.Name()),
        seenDirs,
      ); err != nil {
        return err
      }
    }
    return nil
  }
  if !mode.IsRegular() {
    return nil
  }
  data, err := os.ReadFile(src)
  if err != nil {
    return err
  }
  if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
    return err
  }
  return os.WriteFile(dst, data, mode.Perm()|0o200)
}

func shouldSkipLSPCommandWorkspaceDir(name string) bool {
  switch name {
  case ".git", ".hg", ".svn", "node_modules":
    return true
  default:
    return false
  }
}

func pathHasSegment(file string, segment string) bool {
  for _, part := range strings.Split(filepath.Clean(file), string(filepath.Separator)) {
    if part == segment {
      return true
    }
  }
  return false
}

func projectPathHasSegment(cwd string, file string, segment string) bool {
  rel, ok := projectRelativePath(cwd, file)
  if !ok {
    return false
  }
  return pathHasSegment(rel, segment)
}

func lspProjectTargetHasSegment(opts *lspCommandOptions, segment string) bool {
  if opts.uri == "" {
    return false
  }
  target, err := filePathFromURI(opts.uri)
  if err != nil {
    return false
  }
  return projectPathHasSegment(opts.cwd, target, segment)
}

func lspProjectTargetOutsideCwd(opts *lspCommandOptions) bool {
  if opts.uri == "" {
    return false
  }
  target, err := filePathFromURI(opts.uri)
  if err != nil {
    return false
  }
  _, ok := projectRelativePath(opts.cwd, target)
  return !ok
}

func remapLSPPluginsJSONForTempWorkspace(raw string, cwd string, tempRoot string) string {
  if strings.TrimSpace(raw) == "" {
    return raw
  }
  var entries []map[string]any
  if err := json.Unmarshal([]byte(raw), &entries); err != nil {
    return raw
  }
  changed := false
  for _, entry := range entries {
    config, ok := entry["config"].(map[string]any)
    if !ok {
      continue
    }
    configFile, ok := config["configFile"].(string)
    if !ok || !filepath.IsAbs(configFile) {
      continue
    }
    mapped, ok := tempPathFor(cwd, tempRoot, configFile)
    if !ok {
      continue
    }
    config["configFile"] = mapped
    changed = true
  }
  if !changed {
    return raw
  }
  next, err := json.Marshal(entries)
  if err != nil {
    return raw
  }
  return string(next)
}

func tempPathFor(cwd string, tempRoot string, file string) (string, bool) {
  rel, err := filepath.Rel(cwd, file)
  if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
    return "", false
  }
  return filepath.Join(tempRoot, rel), true
}

func projectRelativePath(cwd string, file string) (string, bool) {
  rel, err := filepath.Rel(cwd, file)
  if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
    return "", false
  }
  return rel, true
}

func firstURIArgument(raw string) (string, error) {
  if strings.TrimSpace(raw) == "" {
    return "", errors.New("@ttsc/lint lsp-execute-command: missing URI argument")
  }
  var args []json.RawMessage
  if err := json.Unmarshal([]byte(raw), &args); err != nil {
    return "", fmt.Errorf("@ttsc/lint lsp-execute-command: invalid arguments JSON: %w", err)
  }
  if len(args) == 0 {
    return "", errors.New("@ttsc/lint lsp-execute-command: missing URI argument")
  }
  var uri string
  if err := json.Unmarshal(args[0], &uri); err != nil || strings.TrimSpace(uri) == "" {
    return "", errors.New("@ttsc/lint lsp-execute-command: first argument must be a document URI")
  }
  return uri, nil
}

func filePathFromURI(raw string) (string, error) {
  parsed, err := url.Parse(raw)
  if err != nil {
    return "", fmt.Errorf("@ttsc/lint: invalid file URI %q: %w", raw, err)
  }
  if parsed.Scheme != "file" {
    return "", fmt.Errorf("@ttsc/lint: expected file URI, got %q", raw)
  }
  path := parsed.Path
  if parsed.Host != "" {
    path = "//" + parsed.Host + path
  }
  if path == "" {
    return "", fmt.Errorf("@ttsc/lint: empty file URI path: %q", raw)
  }
  if os.PathSeparator == '\\' && strings.HasPrefix(path, "/") && len(path) >= 3 && path[2] == ':' {
    path = path[1:]
  }
  abs, err := filepath.Abs(path)
  if err != nil {
    return "", err
  }
  return abs, nil
}

func byteOffsetToLSPPosition(text string, offset int) lspPosition {
  if offset < 0 {
    offset = 0
  }
  if offset > len(text) {
    offset = len(text)
  }
  line, character := 0, 0
  for i := 0; i < offset; {
    r, size := utf8.DecodeRuneInString(text[i:])
    if r == utf8.RuneError && size == 0 {
      break
    }
    if i+size > offset {
      break
    }
    switch r {
    case '\r':
      line++
      character = 0
      i += size
      if i < offset && i < len(text) && text[i] == '\n' {
        i++
      }
      continue
    case '\n':
      line++
      character = 0
    default:
      if n := utf16.RuneLen(r); n > 0 {
        character += n
      } else {
        character++
      }
    }
    i += size
  }
  return lspPosition{Line: line, Character: character}
}

func writeJSON(value any) int {
  data, err := json.Marshal(value)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  fmt.Fprintln(os.Stdout, string(data))
  return 0
}
