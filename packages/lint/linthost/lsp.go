package linthost

import (
  "context"
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
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
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
  Range              lspRange                `json:"range"`
  Severity           int                     `json:"severity,omitempty"`
  Code               string                  `json:"code,omitempty"`
  CodeDescription    *lspCodeDescription     `json:"codeDescription,omitempty"`
  Source             string                  `json:"source,omitempty"`
  Message            string                  `json:"message"`
  Tags               []int                   `json:"tags,omitempty"`
  RelatedInformation []lspRelatedInformation `json:"relatedInformation,omitempty"`
}

// lspLocation is the LSP Location: a URI plus a range inside it. The lint
// sidecar only ever emits locations in the file being linted, so the URI is
// always that file's, but the field is present because LSP requires it on every
// related location.
type lspLocation struct {
  URI   string   `json:"uri"`
  Range lspRange `json:"range"`
}

// lspRelatedInformation is one entry of a diagnostic's relatedInformation: a
// secondary location the finding points at, with a message naming the link. The
// editor renders each as a clickable line under the diagnostic.
type lspRelatedInformation struct {
  Location lspLocation `json:"location"`
  Message  string      `json:"message"`
}

// lspCodeDescription mirrors the proxy's LSPCodeDescription: a docs URL for the
// diagnostic's Code, which editors surface as the link on the rule id in the
// Problems panel. ruleDocumentationURL derives the href per rule family (see
// rule_docs.go); rules with no vetted page leave the whole field absent.
type lspCodeDescription struct {
  Href string `json:"href"`
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

type lspProjectDiagnostics struct {
  URI         string          `json:"uri"`
  Diagnostics []lspDiagnostic `json:"diagnostics"`
}

type lspDiagnosticsResult struct {
  Document []lspDiagnostic        `json:"document"`
  Project  *lspProjectDiagnostics `json:"project,omitempty"`
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
  rangeJSON          string
  semanticConfigPath string
  tsconfig           string
  uri                string
  projectIdentity    publicrule.ProjectIdentity
}

// lspCommandIDs is the workspace/executeCommand ids owned by @ttsc/lint, shared
// by the one-shot verb and the resident lsp-serve loop.
func lspCommandIDs() []string {
  return []string{
    commandLintFixAll,
    commandLintApplySuggestion,
    commandFormatDocument,
  }
}

// lspCodeActionKinds is the CodeActionKind values @ttsc/lint may return.
func lspCodeActionKinds() []string {
  return []string{"quickfix.ttsc", "source.fixAll.ttsc", "source.format"}
}

// RunLSPCommandIDs prints the workspace/executeCommand ids owned by @ttsc/lint.
// It acquires no project. Serialization failures return 2 and output failures
// return 3; the caller owns the standard streams.
//
// @evidence contracts/common.md#principled-implementation The shared lint command registry supplies the exact advertised identifiers, and the ordinary JSON writer preserves serialization/output failures as nonzero exit status.
// @evidence contracts/common.md#clear-and-simple-design This verb exposes registry data only; command dispatch and project evaluation remain separate responsibilities.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Command names are the lint sidecar protocol, not fixture answers or patched language-server registrations.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the registry boundary, absence of project acquisition and output failure codes under documentation-skill guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This verb serializes protocol identifiers without native path, filesystem identity or child-process selection.
// @evidenceExclude contracts/performance.md#efficient-algorithms The verb emits a fixed registry rather than choosing a project processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The fixed command list requires no reusable compilation or request coordination.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns stdout; this verb acquires no handle or retained project state.
func RunLSPCommandIDs([]string) int {
  return writeJSON(lspCommandIDs())
}

// RunLSPCodeActionKinds prints the CodeActionKind values @ttsc/lint may return.
// These are advertised kinds, not evidence that an action applies to a document.
// It loads no project; JSON/output failures use the shared writer's exit codes.
//
// @evidence contracts/common.md#principled-implementation The same supported action categories used by code-action filtering are published as JSON; availability remains a document query rather than a fabricated capability result.
// @evidence contracts/common.md#clear-and-simple-design Registry publication is separate from per-document rule evaluation and action construction.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The categories encode the supported quick-fix, fix-all and formatting protocol without consumer-specific or test-only kinds.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes advertised kinds from applicable actions and states acquisition/failure behavior under documentation-skill guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Protocol category serialization chooses no native path or process capability.
// @evidenceExclude contracts/performance.md#efficient-algorithms This fixed registry publication chooses no project processing algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work It coordinates no compiler work or cache consumers.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It retains no project or historical state and acquires no owned stream handle.
func RunLSPCodeActionKinds([]string) int {
  return writeJSON(lspCodeActionKinds())
}

// RunLSPDiagnostics prints lint diagnostics for one file URI as LSP JSON.
// The document uses saved project state. Parse diagnostics remain upstream's
// responsibility; lint results may also carry a separate project publication.
// Acquisition/evaluation errors return 2, and output write errors return 3.
//
// @evidence contracts/common.md#principled-implementation The native lint engine supplies saved-project findings, filtered to the physical document identity; compiler source bytes determine UTF-16 primary/related ranges, severity and supported diagnostic tags. Upstream retains ownership of parse diagnostics.
// @evidence contracts/common.md#clear-and-simple-design The verb parses options, evaluates through the shared findings path and serializes one result. Project publications and document findings remain separate payload fields.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Real rule findings supply diagnostics; no source-pattern imitation, consumer exception or foreign server mutation replaces the engine.
// @evidence contracts/common.md#meaningful-documentation Native prose explains saved-state ownership, upstream parse diagnostics, optional project results and error codes under documentation-skill guidance; wire helpers state UTF-16 units and omission behavior.
// @evidence contracts/portability.md#os-neutral-implementation File URLs are decoded to native paths and physical project identity filters the result. Path construction uses filepath operations; source coordinates use compiler line semantics rather than platform newline guesses.
// @evidence contracts/performance.md#efficient-algorithms One lint cycle supplies document/project results, then findings are filtered linearly. Compiler source-file line maps are shared across primary/related ranges instead of rescanning all source bytes for every position; rule/checker costs remain with the engine.
// @evidence contracts/performance.md#reuse-equivalent-work The shared acquisition boundary permits resident callers to use their current Program and selected rule state. This one-shot verb does not retain a second cache keyed only by the document URI.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned acquisition-release callback is deferred before result handling; resident ownership is retained by its host. JSON/range values live only through this response, with no historical result population retained here.
func RunLSPDiagnostics(args []string) int {
  opts, ok := parseLSPCommandOptions("lsp-diagnostics", args)
  if !ok {
    return 2
  }
  result, code := computeLSPDiagnostics(opts)
  if code != 0 {
    return code
  }
  return writeJSON(result)
}

// RunLSPProjectDiagnostics prints the current project-rule publication without
// requiring an open TypeScript document.
// Disabled project rules yield an empty publication that clears older results.
// A project parse failure yields null instead, retaining the host's last good
// publication. Acquisition/evaluation errors return 2; output failures return 3.
//
// @evidence contracts/common.md#principled-implementation Only project rules run, and the logical config URI anchors their publication. An evaluated empty set differs from a project that could not parse, so null does not erase the host's last good answer.
// @evidence contracts/common.md#clear-and-simple-design Project-only evaluation has its own payload boundary while sharing rule loading and Program acquisition with document commands.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Actual rule evaluation determines the publication; a failed parse is not converted to a fabricated successful empty result.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain no-document usage, disabled/parse-failed distinctions and exit codes under the documentation skill's absence and failure guidance.
// @evidence contracts/portability.md#os-neutral-implementation Project anchors are native driver inputs while the published config identity is encoded as a file URL; native path construction remains with filepath and the project identity owner.
// @evidence contracts/performance.md#efficient-algorithms The engine evaluates the required project cycle once without linting an arbitrary document merely to obtain its publication; findings are converted in one pass.
// @evidence contracts/performance.md#reuse-equivalent-work Program acquisition shares the resident host's current state when authorized; the one-shot publication does not introduce an independent stale project-result cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The acquisition callback is deferred even when later evaluation fails. Publication buffers are response-local, and this verb retains no project history after completion.
func RunLSPProjectDiagnostics(args []string) int {
  opts, ok := parseLSPCommandOptions("lsp-project-diagnostics", args)
  if !ok {
    return 2
  }
  result, code := computeLSPProjectDiagnostics(opts)
  if code != 0 {
    return code
  }
  return writeJSON(result)
}

// computeLSPProjectDiagnostics evaluates only project rules and returns an
// empty publication when they are disabled, allowing the proxy to clear the
// previous generation. A project that does not parse has no publication at
// all: acquireProgram returns no Program alongside its parse diagnostics, so
// the command prints null and the host keeps the producer's last good answer
// instead of clearing it with a broken evaluation.
func computeLSPProjectDiagnostics(opts *lspCommandOptions) (*lspProjectDiagnostics, int) {
  rules, err := loadRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  engine := NewEngineWithResolver(rules)
  if err := engine.ConfigError(); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  engine.SetCurrentDirectory(opts.cwd)
  prog, _, closeProgram, err := acquireProgram(opts, engine.NeedsTypeChecker())
  if closeProgram != nil {
    defer closeProgram()
  }
  if err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: %v\n", err)
    return nil, 2
  }
  if prog == nil {
    return nil, 0
  }
  publication := &lspProjectDiagnostics{
    URI:         fileURL(prog.identity.LogicalConfigPath),
    Diagnostics: []lspDiagnostic{},
  }
  for _, finding := range prog.runProjectCycle(engine).finalize() {
    publication.Diagnostics = append(
      publication.Diagnostics,
      findingToLSPDiagnostic(finding),
    )
  }
  return publication, 0
}

// computeLSPDiagnostics builds the diagnostics result for one file URI. Split
// from RunLSPDiagnostics so the resident lsp-serve loop can produce the same
// result against a warm Program without re-parsing per verb.
func computeLSPDiagnostics(opts *lspCommandOptions) (lspDiagnosticsResult, int) {
  findings, prog, closeProgram, code := lspFindings(opts, false)
  if closeProgram != nil {
    defer closeProgram()
  }
  if code != 0 {
    return lspDiagnosticsResult{}, code
  }
  result := lspDiagnosticsResult{Document: []lspDiagnostic{}}
  for _, finding := range filterFindingsForPath(findings, mustFilePathFromURI(opts.uri)) {
    result.Document = append(result.Document, findingToLSPDiagnostic(finding))
  }
  if prog != nil && prog.projectCycle != nil && len(prog.projectCycle.results.byName) > 0 {
    publication := &lspProjectDiagnostics{
      URI:         fileURL(prog.identity.LogicalConfigPath),
      Diagnostics: []lspDiagnostic{},
    }
    for _, finding := range prog.projectCycle.findings {
      publication.Diagnostics = append(publication.Diagnostics, findingToLSPDiagnostic(finding))
    }
    result.Project = publication
  }
  return result, 0
}

// RunLSPCodeActions prints code actions available for one file URI/range.
// Suggestions are range-limited and capture source/content fingerprints for
// later validation. Fix-all and format actions remain document-wide. Excluded
// or outside-project targets yield no actions; evaluation failures return 2.
//
// @evidence contracts/common.md#principled-implementation Context kind filters select supported action categories, valid ranges delimit suggestions, and actual fixable findings determine availability. Suggestion commands retain source hashes and exact finding/edit fingerprints so execution can reject stale choices.
// @evidence contracts/common.md#clear-and-simple-design Shared findings feed separate suggestion, fix-all and format constructors; request filtering occurs before project work when no supported kind can apply.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Actions are based on current rule findings rather than canned fixes. node_modules and physical project containment preserve the real edit boundary instead of relying on document spelling alone.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish range-limited suggestions from document-wide actions and describe excluded/error outcomes; helper comments explain fingerprint purpose under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation URI decoding and native project containment use filepath and resolved physical anchors; commands retain the editor URI separately for returned edits. No filename is interpolated into shell text.
// @evidence contracts/performance.md#efficient-algorithms Irrelevant kinds and excluded targets return before evaluation. The required lint cycle runs once; finding filters and suggestion construction scan their populations, with each source hash shared across that file's suggestions and compiler line maps reused for ranges.
// @evidence contracts/performance.md#reuse-equivalent-work Within one response, suggestions from the same immutable SourceFile share its content hash and line map. Resident acquisition remains the owning Program reuse boundary; an action's hash does not authorize stale execution.
// @evidence contracts/performance.md#bound-retention-and-release-resources Acquisition release is deferred, and source-hash/action maps are local to the response. Returned commands transfer only serialized selection data, not compiler leases or mutable AST references.
func RunLSPCodeActions(args []string) int {
  opts, ok := parseLSPCommandOptions("lsp-code-actions", args)
  if !ok {
    return 2
  }
  actions, code := computeLSPCodeActions(opts)
  if code != 0 {
    return code
  }
  return writeJSON(actions)
}

// computeLSPCodeActions builds the code actions for one file URI/range. Split
// from RunLSPCodeActions so the resident lsp-serve loop reuses it over a warm
// Program.
func computeLSPCodeActions(opts *lspCommandOptions) ([]lspCodeAction, int) {
  acceptsLint := acceptsActionKind(opts.contextJSON, "source.fixAll.ttsc")
  acceptsQuickFix := acceptsActionKind(opts.contextJSON, "quickfix.ttsc")
  acceptsFormat := acceptsActionKind(opts.contextJSON, "source.format")
  quickFixRange, quickFixRangeOK := parseRequestedLSPRange(opts.rangeJSON)
  if acceptsQuickFix && !quickFixRangeOK {
    acceptsQuickFix = false
  }
  if !acceptsLint && !acceptsQuickFix && !acceptsFormat {
    return []lspCodeAction{}, 0
  }
  if lspProjectTargetHasSegment(opts, "node_modules") {
    return []lspCodeAction{}, 0
  }
  if lspProjectTargetOutsideCwd(opts) {
    return []lspCodeAction{}, 0
  }
  findings, _, closeProgram, code := lspFindings(opts, acceptsFormat)
  if closeProgram != nil {
    defer closeProgram()
  }
  if code != 0 {
    return nil, code
  }
  findings = filterFindingsForPath(findings, mustFilePathFromURI(opts.uri))
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
  return actions, 0
}

// RunLSPExecuteCommand returns a WorkspaceEdit for a lint-owned command.
// It never writes the original project. Suggestions are revalidated against
// current source and findings; stale selections yield no edit. Format can use
// the live buffer from stdin. Checker-dependent operations edit a temporary
// project and return a change for the editor to apply.
//
// Syntax-invalid overlays and unchanged documents yield no edit. Cascades
// must converge within the shared pass limits; acquisition/usage failures
// return 2, and write failures return 3. Input and project-copy sizes have no
// independent byte cap; temporary cleanup is best effort.
//
// @evidence contracts/common.md#principled-implementation Supported command IDs dispatch to current-source suggestion validation or atomic finding-group fixes. Live formatting uses the supplied buffer; checker-dependent fixes use a copied project and preserve original-project ownership until the editor applies the returned WorkspaceEdit.
// @evidence contracts/common.md#clear-and-simple-design One command boundary owns option/URI validation, then focused helpers own suggestion selection, lightweight buffer formatting and checker-backed temporary cascades. Shared edit selection/application keeps overlap policy consistent with CLI fixes.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Content/finding/edit fingerprints reject stale suggestions rather than forcing a prior answer onto changed text. Temporary projects serve the actual checker requirement; invalid overlays do not receive compensating partial edits or foreign editor mutations.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state original-project protection, live/disk paths, stale/no-op behavior, convergence and cleanup/size limits under documentation-skill guidance; helper prose explains logical copy spelling versus physical containment.
// @evidence contracts/portability.md#os-neutral-implementation URI and native paths remain distinct. Physical containment guards the original target, while logical project paths locate copied aliases/junctions. Native filepath operations build temporary destinations; compiler parser inputs use the required protocol slash spelling.
// @evidence contracts/performance.md#efficient-algorithms Built-in AST/source formatting avoids a whole-project copy/checker. Checker-dependent cascades rebuild after actual edits so facts match changed text. Validated disjoint edits copy source gaps and replacement text once using the shared linear builder, avoiding a full-string copy per edit.
// @evidence contracts/performance.md#reuse-equivalent-work All edits in a pass share one rule/Program generation. Changed text requires another parse/check; a prior finding cannot be reused solely because its URI matches. Existing rule/descriptor acquisition caches retain their own validated-input boundaries.
// @evidence contracts/performance.md#bound-retention-and-release-resources Temporary creation paths clean up on setup failure and defer removal after transfer. Programs close per pass and suggestion acquisition releases on every return; copied project, stdin text and edit buffers grow with actual inputs without fixed byte limits, and removal errors remain an explicit best-effort limitation.
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
  projectContextJSON := fs.String("project-context-json", "", "")
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
  projectIdentity, err := decodeProjectIdentity(*projectContextJSON)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, false
  }
  return &lspCommandOptions{
    argumentsJSON:      *argumentsJSON,
    command:            *command,
    contextJSON:        *contextJSON,
    contentStdin:       *contentStdin,
    cwd:                resolvedCwd,
    pluginsJSON:        *pluginsJSON,
    rangeJSON:          *rangeJSON,
    semanticConfigPath: os.Getenv(semanticConfigPathEnv),
    tsconfig:           *tsconfig,
    uri:                *uri,
    projectIdentity:    projectIdentity,
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
  rules, err := loadLSPCommandRules(
    opts.pluginsJSON,
    opts.cwd,
    opts.tsconfig,
    target,
    includeFormatDefaults,
  )
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, nil, nil, 2
  }
  engine := NewEngineWithResolver(rules)
  if err := engine.ConfigError(); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, nil, nil, 2
  }
  engine.SetCurrentDirectory(opts.cwd)
  prog, parseDiags, closeProgram, err := acquireProgram(opts, engine.NeedsTypeChecker())
  if err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: %v\n", err)
    return nil, nil, nil, 2
  }
  if len(parseDiags) > 0 {
    // tsgo already owns parse diagnostics in the upstream LSP process.
    return nil, prog, closeProgram, 0
  }
  findings := prog.runLintCycle(engine)
  return findings, prog, closeProgram, 0
}

// loadLSPCommandRules constructs the resolver shared by every LSP command
// path. Format requests use the same missing-config fallback, documented
// defaults, editor overrides, and language precedence as the CLI formatter and
// in-memory buffer formatter; lint-only requests retain the strict lint loader.
// formatTarget is the real editor document even when cwd/tsconfig point at the
// temporary workspace used by the disk execute-command path.
func loadLSPCommandRules(
  pluginsJSON string,
  cwd string,
  tsconfigPath string,
  formatTarget string,
  includeFormatDefaults bool,
) (RuleResolver, error) {
  if !includeFormatDefaults {
    return loadRules(pluginsJSON, cwd, tsconfigPath)
  }
  rules, err := loadFormatRules(pluginsJSON, cwd, tsconfigPath)
  if err != nil {
    return nil, err
  }
  return newFormatCommandResolver(
    rules,
    filepath.Dir(formatTarget),
    vscodeLanguageID(formatTarget),
  )
}

func mustFilePathFromURI(uri string) string {
  target, err := filePathFromURI(uri)
  if err != nil {
    return ""
  }
  return target
}

func filterFindingsForPath(findings []*Finding, target string) []*Finding {
  target = canonicalProjectPath("", realProjectPath(target))
  out := make([]*Finding, 0, len(findings))
  for _, finding := range findings {
    if finding == nil || finding.File == nil {
      continue
    }
    if canonicalProjectPath("", realProjectPath(finding.File.FileName())) == target {
      out = append(out, finding)
    }
  }
  return out
}

func findingToLSPDiagnostic(finding *Finding) lspDiagnostic {
  return lspDiagnostic{
    Range:              lspRangeForFinding(finding),
    Severity:           lspSeverity(finding.Severity),
    Code:               finding.Rule,
    CodeDescription:    lspCodeDescriptionForRule(finding.Rule),
    Source:             "@ttsc/lint",
    Message:            finding.Message,
    Tags:               lspDiagnosticTags(finding.Tags),
    RelatedInformation: lspRelatedInformationForFinding(finding),
  }
}

// lspRelatedInformationForFinding renders the finding's related locations. Each
// location lives in the finding's own file, so it resolves the byte ranges
// against that file's text and stamps the file's URI onto every entry. Returns
// nil for a finding with no related locations, keeping the omitempty field
// absent rather than an empty array.
func lspRelatedInformationForFinding(finding *Finding) []lspRelatedInformation {
  if finding == nil || len(finding.RelatedInformation) == 0 || finding.File == nil {
    return nil
  }
  uri := fileURL(finding.File.FileName())
  out := make([]lspRelatedInformation, 0, len(finding.RelatedInformation))
  for _, item := range finding.RelatedInformation {
    out = append(out, lspRelatedInformation{
      Location: lspLocation{
        URI: uri,
        Range: lspRange{
          Start: sourceFileLSPPosition(finding.File, item.Pos),
          End:   sourceFileLSPPosition(finding.File, item.End),
        },
      },
      Message: item.Message,
    })
  }
  return out
}

// lspDiagnosticTags converts the rule-supplied tags to their integer wire
// values, dropping any the wire does not define so a future rule.DiagnosticTag
// value cannot ship an integer no editor understands. Returns nil for an empty
// set, keeping the omitempty field absent rather than an empty array.
func lspDiagnosticTags(tags []publicrule.DiagnosticTag) []int {
  if len(tags) == 0 {
    return nil
  }
  out := make([]int, 0, len(tags))
  for _, tag := range tags {
    switch tag {
    case publicrule.DiagnosticTagUnnecessary, publicrule.DiagnosticTagDeprecated:
      out = append(out, int(tag))
    }
  }
  if len(out) == 0 {
    return nil
  }
  return out
}

func lspRangeForFinding(finding *Finding) lspRange {
  return lspRange{
    Start: sourceFileLSPPosition(finding.File, finding.Pos),
    End:   sourceFileLSPPosition(finding.File, finding.End),
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
  physicalCwd := realProjectPath(opts.cwd)
  physicalTarget := realProjectPath(target)
  if _, ok := projectRelativePath(physicalCwd, physicalTarget); !ok {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: LSP command target %s is outside cwd %s\n", physicalTarget, physicalCwd)
    return nil, 2
  }
  if lspProjectTargetHasSegment(opts, "node_modules") {
    return nil, 0
  }
  selection, err := suggestionSelectionArgument(opts.argumentsJSON)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  current, err := os.ReadFile(physicalTarget)
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
  findings = filterFindingsForPath(findings, physicalTarget)
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
          Start: sourceFileLSPPosition(finding.File, edit.Pos),
          End:   sourceFileLSPPosition(finding.File, edit.End),
        },
        NewText: edit.Text,
      })
    }
    current, err := os.ReadFile(physicalTarget)
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
  if lspProjectTargetHasSegment(opts, "node_modules") {
    return nil, 0
  }
  // Containment is the only physical guard: resolve both sides so a symlinked
  // or short-name spelling of either cannot smuggle the target outside cwd.
  // `target` itself stays in its LOGICAL (URI) spelling for everything that
  // indexes into the temp workspace below — the temp tree materializes a
  // project-internal symlink/junction under its logical name, so resolving the
  // target to its physical destination here would address a path the temp tree
  // never created (samchon/ttsc#614).
  physicalCwd := realProjectPath(opts.cwd)
  physicalTarget := realProjectPath(target)
  if _, ok := projectRelativePath(physicalCwd, physicalTarget); !ok {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: LSP command target %s is outside cwd %s\n", physicalTarget, physicalCwd)
    return nil, 2
  }
  original, err := os.ReadFile(target)
  if err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: read %s: %v\n", target, err)
    return nil, 2
  }
  return lspWorkspaceEditForSeededCommand(opts, target, string(original), nil)
}

// lspWorkspaceEditForSeededCommand runs a command in the ordinary temporary
// project while optionally replacing the target copy with editor-owned text.
// original is always the document against which the returned full-document
// edit is measured. A non-nil sourceOverlay is written only inside the
// temporary workspace, so type-aware contributor rules receive a real Program
// and Checker for the dirty document without using or mutating its disk twin as
// command input. Dirty buffers with syntax errors fail closed before any fix is
// applied.
func lspWorkspaceEditForSeededCommand(
  opts *lspCommandOptions,
  target string,
  original string,
  sourceOverlay *string,
) (*lspWorkspaceEdit, int) {
  // Pass the LOGICAL cwd/target so the temp workspace is indexed by the
  // project's logical layout (a project-internal symlink or junction keeps its
  // logical name). Physical resolution stays inside prepareLSPCommandWorkspace
  // for the copy source and inside tempPathFor's boundary-alias fallback.
  tempRoot, tempTarget, tempTsconfig, cleanup, err := prepareLSPCommandWorkspace(opts.cwd, opts.tsconfig, target)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  defer cleanup()

  if sourceOverlay != nil {
    if err := os.MkdirAll(filepath.Dir(tempTarget), 0o755); err != nil {
      fmt.Fprintf(os.Stderr, "@ttsc/lint: create dirty-buffer directory: %v\n", err)
      return nil, 2
    }
    if err := os.WriteFile(tempTarget, []byte(*sourceOverlay), 0o600); err != nil {
      fmt.Fprintf(os.Stderr, "@ttsc/lint: seed dirty buffer %s: %v\n", target, err)
      return nil, 2
    }
  }

  pluginsJSON := remapLSPPluginsJSONForTempWorkspace(opts.pluginsJSON, opts.cwd, tempRoot)
  rules, err := loadLSPCommandRules(
    pluginsJSON,
    tempRoot,
    tempTsconfig,
    target,
    opts.command == commandFormatDocument,
  )
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  engine := NewEngineWithResolver(rules)
  if err := engine.ConfigError(); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  // The seeded command's Program opens in the temporary workspace.
  engine.SetCurrentDirectory(tempRoot)
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
      projectIdentity:  opts.projectIdentity,
    })
    if err != nil {
      fmt.Fprintf(os.Stderr, "@ttsc/lint: %v\n", err)
      return nil, 2
    }
    if len(parseDiags) > 0 {
      prog.close()
      return nil, 0
    }
    // The command target must resolve to a source file the temp program loaded.
    // A nil here means the temp workspace did not materialize the target under
    // the spelling the tsconfig references — the signature of the symlink/
    // junction copy regression. Fail loud (exit 2) instead of returning a silent
    // nil edit the editor cannot distinguish from an already-clean document.
    targetFile := prog.findSourceFile(tempTarget)
    if targetFile == nil {
      prog.close()
      fmt.Fprintf(os.Stderr,
        "@ttsc/lint: LSP %s: target source file %s is not in the program\n",
        opts.command, tempTarget)
      return nil, 2
    }
    if sourceOverlay != nil &&
      len(prog.tsProgram.GetSyntacticDiagnostics(context.Background(), targetFile)) > 0 {
      // A dirty overlay buffer with syntax errors is a benign no-op: don't fight
      // the editor's own diagnostics on the dirty document with a partial fix.
      prog.close()
      return nil, 0
    }
    // This command edits a document, so it walks the project's own sources the
    // way `format` does. Reading the imported TypeScript the lint cycle covers
    // would widen nothing here: the edit is bounded to one target below, and a
    // read-scope widening must not open a write the project never had.
    findings := filterFindingsForPath(prog.runWriteScopedCycle(engine), tempTarget)
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
  return workspaceEditForFullDocument(opts.uri, original, string(next)), 0
}

// lspFormatBuffer formats an in-memory document buffer using only the
// format-class rules. It is the path behind --content-stdin for
// ttsc.format.document.
//
// Built-in format rules are AST+source only and use the lightweight single-file
// parser below. Contributor format rules conservatively require a checker, so
// they use a temporary project seeded with `content`. Both branches derive
// findings and edits from the supplied buffer; neither uses stale disk content
// as the document or mutates the original project.
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
  physicalCwd := realProjectPath(opts.cwd)
  physicalTarget := realProjectPath(target)
  if _, ok := projectRelativePath(physicalCwd, physicalTarget); !ok {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: LSP command target %s is outside cwd %s\n", physicalTarget, physicalCwd)
    return nil, 2
  }
  if lspProjectTargetHasSegment(opts, "node_modules") {
    return nil, 0
  }

  resolver, err := loadLSPCommandRules(
    opts.pluginsJSON,
    opts.cwd,
    opts.tsconfig,
    target,
    true,
  )
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  engine := NewEngineWithResolver(resolver)
  if err := engine.ConfigError(); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, 2
  }
  engine.SetCurrentDirectory(opts.cwd)
  if engine.NeedsTypeChecker() {
    // Contributor format rules conservatively require a checker. Seed the
    // dirty text into the temporary project so the checker, findings, fix
    // ranges, and final WorkspaceEdit all describe the same editor document.
    // Built-in AST-only format rules keep the fast single-file path below.
    // Pass the LOGICAL target: the seeded command indexes it into the temp
    // workspace (which mirrors the project's logical layout), so a
    // project-internal symlink/junction must keep its logical name here too.
    sourceOverlay := content
    return lspWorkspaceEditForSeededCommand(
      opts,
      target,
      content,
      &sourceOverlay,
    )
  }
  scriptKind := scriptKindForPath(target)

  text := content
  converged := false
  // The tsgo parser asserts on normalized (forward-slash) absolute paths;
  // `target` comes from filepath.Abs and carries backslashes on Windows.
  parseName := filepath.ToSlash(target)
  for pass := 0; pass < maxFormatPasses; pass++ {
    file := shimparser.ParseSourceFile(shimast.SourceFileParseOptions{FileName: parseName}, text, scriptKind)
    if file == nil || len(file.Diagnostics()) > 0 || len(file.JSDiagnostics()) > 0 {
      // The parser separates ordinary syntax errors from JS/JSX-only errors.
      // Reject both, matching the checker's syntactic diagnostics policy.
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
// needs so JSX syntax is enabled only for .jsx/.tsx, JavaScript extensions use
// JavaScript grammar, and TypeScript remains the default for other inputs.
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
// applyFindingFixes/applyTextEditsToFile (fix.go): it groups every fixable
// finding's edits, selects a non-overlapping, per-finding-atomic set with the
// same selectTextEditGroups logic, copies source spans and replacements once, and
// returns the new string plus the number of edits applied. It never writes to
// disk and never reloads a Program. Findings carry byte offsets into the same
// `text` that was just parsed, so no per-file grouping is needed — but each
// finding still forms its own atomic edit group so a partially-overlapped
// multi-edit fix is dropped whole rather than half-applied (samchon/ttsc#605).
func applyFindingFixesToText(text string, findings []*Finding) (string, int) {
  groups := make([][]TextEdit, 0, len(findings))
  for _, finding := range findings {
    if finding == nil || len(finding.Fix) == 0 {
      continue
    }
    groups = append(groups, finding.Fix)
  }
  selected := selectTextEditGroups(len(text), groups)
  if len(selected) == 0 {
    return text, 0
  }
  next := applySelectedTextEdits(text, selected)
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
  // Copy from the resolved (physical) cwd so a symlinked or short-name project
  // root still descends into the real tree; the copy reproduces the project's
  // LOGICAL layout, which tempPathFor above indexes into by the logical cwd.
  physicalCwd := realProjectPath(cwd)
  if err := copyLSPCommandWorkspace(physicalCwd, tempRoot); err != nil {
    cleanup()
    return "", "", "", nil, err
  }
  if err := linkNearestNodeModules(tempRoot, physicalCwd); err != nil {
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
      // A skipped directory that is a reparse point (a symlinked or junctioned
      // node_modules/.git) is dropped without materializing its contents. A
      // junction reports ModeSymlink on current toolchains and ModeIrregular on
      // older ones, so check both bits.
      if entry.Type()&(fs.ModeSymlink|fs.ModeIrregular) != 0 {
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
    // A directory that is itself a reparse point — a symlink OR an NTFS
    // junction — is not descended into by filepath.WalkDir, so its contents
    // must be materialized here under the LOGICAL name. Go reports a junction as
    // ModeSymlink on current toolchains but as ModeIrregular on older ones;
    // treat either bit as a link so the copy is correct regardless of version.
    // A plain directory (neither bit) is created empty and left for WalkDir to
    // descend (samchon/ttsc#614).
    isLink := linkInfo.Mode()&(os.ModeSymlink|os.ModeIrregular) != 0
    if isLink {
      // resolveDirLink chases the symlink/junction via os.Readlink, which
      // resolves junctions that neither ModeSymlink nor EvalSymlinks expose on
      // older toolchains. The real path keys the cycle guard, scoped to the
      // active recursion branch (defer delete) so sibling aliases pointing at
      // one real directory (e.g. `src-a -> real-src` and `src-b -> real-src` in
      // different tsconfig entries) each get materialized; the test
      // `TestLSPExecuteCommandMaterializesDuplicateSymlinkedDirectories` pins
      // this contract.
      realDir := resolveDirLink(src)
      if _, ok := seenDirs[realDir]; ok {
        return nil
      }
      seenDirs[realDir] = struct{}{}
      defer delete(seenDirs, realDir)
    }
    if err := os.MkdirAll(dst, mode.Perm()); err != nil {
      return err
    }
    if !isLink {
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
  if opts.projectIdentity.LogicalProjectRoot != "" &&
    projectPathHasSegment(opts.projectIdentity.LogicalProjectRoot, target, segment) {
    return true
  }
  return projectPathHasSegment(realProjectPath(opts.cwd), realProjectPath(target), segment)
}

func lspProjectTargetOutsideCwd(opts *lspCommandOptions) bool {
  if opts.uri == "" {
    return false
  }
  target, err := filePathFromURI(opts.uri)
  if err != nil {
    return false
  }
  _, ok := projectRelativePath(realProjectPath(opts.cwd), realProjectPath(target))
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

// tempPathFor maps a project `file` to its location inside the temp workspace,
// which mirrors the project's LOGICAL layout. It therefore prefers the logical
// relative path: a project-internal symlink or junction (src -> real-src),
// materialized by copyLSPCommandWorkspace under its logical name, must be
// addressed the same way here — resolving `file` physically would point at a
// spelling (real-src/main.ts) the temp tree never created (samchon/ttsc#614).
// Only when cwd and file don't share a logical prefix — an incidental boundary
// alias such as a Windows 8.3 short cwd or macOS /tmp -> /private/tmp, where the
// two spellings can independently pick either alias — does it fall back to
// realProjectPath to reconcile them. Containment guards resolve physically and
// live at the call sites, not here.
func tempPathFor(cwd string, tempRoot string, file string) (string, bool) {
  if rel, ok := projectRelativePath(cwd, file); ok {
    return filepath.Join(tempRoot, rel), true
  }
  rel, ok := projectRelativePath(realProjectPath(cwd), realProjectPath(file))
  if !ok {
    return "", false
  }
  return filepath.Join(tempRoot, rel), true
}

func projectRelativePath(cwd string, file string) (string, bool) {
  rel, err := filepath.Rel(cwd, file)
  if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
    return "", false
  }
  if filepath.Clean(filepath.Join(cwd, rel)) != filepath.Clean(file) {
    // Windows filepath.Rel folds case regardless of a directory's actual
    // case-sensitivity. Confirm a differently spelled prefix names this root,
    // rather than accepting a distinct case-sensitive sibling as its child.
    // Only the root must exist; an editor target may not have been saved yet.
    candidateRoot := filepath.Clean(file)
    for range strings.Split(rel, string(filepath.Separator)) {
      candidateRoot = filepath.Dir(candidateRoot)
    }
    rootInfo, rootErr := os.Stat(cwd)
    candidateInfo, candidateErr := os.Stat(candidateRoot)
    if rootErr != nil || candidateErr != nil || !os.SameFile(rootInfo, candidateInfo) {
      return "", false
    }
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
  // RFC 8089 gives localhost the same local meaning as an absent authority.
  if parsed.Host != "" && !strings.EqualFold(parsed.Host, "localhost") {
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

// byteOffsetToLSPPosition converts a byte offset in the linted file into the LSP
// Position the editor is given for it: a 0-based line and a column counted in
// UTF-16 code units.
//
// UTF-16 is both the LSP default and the encoding the sidecar protocol fixes:
// the host settles the session's PositionEncodingKind negotiation on UTF-16 so a
// sidecar always emits UTF-16 columns and always receives them, which is why no
// request or response on this wire carries an encoding field. The compiler's own
// ranges for a line and the ranges emitted here therefore agree. See the LSP
// sidecar verb section of
// website/src/content/docs/development/concepts/protocol.mdx.
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
    case '\n', '\u2028', '\u2029':
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

// sourceFileLSPPosition reuses the compiler's immutable line map across a
// finding's primary/related ranges and suggestion edits. Nil source identity
// keeps the existing project-wide zero position.
func sourceFileLSPPosition(file *shimast.SourceFile, offset int) lspPosition {
  if file == nil {
    return lspPosition{}
  }
  if offset < 0 {
    offset = 0
  } else if offset > len(file.Text()) {
    offset = len(file.Text())
  }
  line, character := shimscanner.GetECMALineAndUTF16CharacterOfPosition(file, offset)
  return lspPosition{Line: line, Character: int(character)}
}

func writeJSON(value any) int {
  data, err := json.Marshal(value)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  if _, err := fmt.Fprintln(os.Stdout, string(data)); err != nil {
    fmt.Fprintf(os.Stderr, "@ttsc/lint: write JSON output: %v\n", err)
    return 3
  }
  return 0
}
