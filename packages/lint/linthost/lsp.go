package linthost

import (
  "encoding/json"
  "errors"
  "flag"
  "fmt"
  "io/fs"
  "net/url"
  "os"
  "path/filepath"
  "strings"
  "unicode/utf16"
  "unicode/utf8"
)

const (
  commandLintFixAll     = "ttsc.lint.fixAll"
  commandFormatDocument = "ttsc.format.document"
)

type lspPosition struct {
  Line      int `json:"line"`
  Character int `json:"character"`
}

type lspRange struct {
  Start lspPosition `json:"start"`
  End   lspPosition `json:"end"`
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

type lspCommandOptions struct {
  argumentsJSON string
  command       string
  contextJSON   string
  cwd           string
  pluginsJSON   string
  rangeJSON     string
  tsconfig      string
  uri           string
}

// RunLSPCommandIDs prints the workspace/executeCommand ids owned by @ttsc/lint.
func RunLSPCommandIDs([]string) int {
  return writeJSON([]string{commandLintFixAll, commandFormatDocument})
}

// RunLSPCodeActionKinds prints the CodeActionKind values @ttsc/lint may return.
func RunLSPCodeActionKinds([]string) int {
  return writeJSON([]string{"source.fixAll.ttsc", "source.format"})
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
  acceptsFormat := acceptsActionKind(opts.contextJSON, "source.format")
  if !acceptsLint && !acceptsFormat {
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
  if opts.command != commandLintFixAll && opts.command != commandFormatDocument {
    fmt.Fprintf(os.Stderr, "@ttsc/lint lsp-execute-command: unknown command %q\n", opts.command)
    return 2
  }
  uri, err := firstURIArgument(opts.argumentsJSON)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  opts.uri = uri
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
    Source:   "ttsc/lint",
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
