package driver

import (
  "context"
  "fmt"
  "io"
  "path/filepath"
  "strings"

  "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  "github.com/microsoft/typescript-go/shim/core"
  shimdiagnosticwriter "github.com/microsoft/typescript-go/shim/diagnosticwriter"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
  "github.com/microsoft/typescript-go/shim/tsoptions"
  "github.com/microsoft/typescript-go/shim/tspath"
  "github.com/microsoft/typescript-go/shim/vfs"
  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// SemanticConfigPathEnv carries the user-authored config path when an embedder
// parses a disposable generated wrapper whose location must not become the
// Program's semantic project root.
const SemanticConfigPathEnv = "TTSC_SEMANTIC_CONFIG_PATH"

// Diagnostic is the compilation diagnostic shape ttsc passes around. Kept
// dependency-free (no shim types) so callers can render or inspect freely.
//
// `raw` carries the original tsgo diagnostic for full color/context
// rendering. `lint` carries a plugin-emitted lint diagnostic when the
// diagnostic was produced outside the typecheck pipeline (e.g. by
// `@ttsc/lint`). At most one of `raw` / `lint` is non-nil; both nil falls
// back to the legacy single-line form.
//
// @evidence contracts/common.md#principled-implementation Plain source location and severity accompany at most one native rendering anchor; optional byte spans distinguish unlocated findings from a zero offset.
// @evidence contracts/common.md#clear-and-simple-design One diagnostic value serves structured consumers and rendering without a second public shim-specific payload.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing authored positions remain absent rather than being guessed from generated text.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs and member comments explain renderer anchors, position units and optional spans following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This diagnostic payload carries a producer's source name, not native filesystem identity or capability policy.
// @evidenceExclude contracts/performance.md#efficient-algorithms This value type chooses no computation strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Diagnostics do not independently coordinate requests or authorize reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The diagnostic does not own the compiler lease or result collection lifetime.
type Diagnostic struct {
  // File names the source, or is empty when no source location is available.
  File string

  // Line is one-based; zero means that no authored line is available.
  Line int

  // Column is the one-based byte offset on Line, not a UTF-16 LSP character.
  Column int

  // Code is the compiler or plugin diagnostic identifier.
  Code int32

  // Start is an optional byte offset in the source text.
  Start *int

  // Length is the optional byte extent associated with Start.
  Length *int

  // Message is the producer's readable explanation.
  Message string

  // Severity selects the build outcome and rendered severity.
  Severity Severity
  raw      *ast.Diagnostic
  lint     *shimdiagnosticwriter.LintDiagnostic
}

// Severity classifies a diagnostic's blast radius. ttsc treats Error as a
// build-failing condition; Warning prints but does not flip the exit code.
//
// @evidence contracts/common.md#principled-implementation The enum distinguishes a build-blocking finding from an advisory warning, with Error as the zero value.
// @evidence contracts/common.md#clear-and-simple-design One severity classification serves diagnostic construction, rendering and build status.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The enum uses product categories without consumer-specific success values.
// @evidence contracts/common.md#meaningful-documentation Native prose and constant comments state build effects under documentation-skill guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Severity is a diagnostic classification without a native boundary.
// @evidenceExclude contracts/performance.md#efficient-algorithms This enum selects no computation algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Classification carries no shared computation or invalidation policy.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Classification owns no retained state or handles.
type Severity int

const (
  // SeverityError is the default for tsgo typecheck output and any
  // plugin-emitted finding that should fail the build.
  SeverityError Severity = iota
  // SeverityWarning prints with warning coloring but keeps the build
  // status at zero.
  SeverityWarning
)

// IsError reports whether the diagnostic counts toward the build's error
// total. Useful when plugins want to gate emit on the lint outcome without
// re-walking the diagnostic list.
//
// @evidence contracts/common.md#principled-implementation Native lint findings use their recorded category; other diagnostics count as errors unless explicitly marked warning, matching build totals.
// @evidence contracts/common.md#clear-and-simple-design This predicate owns the build-blocking decision shared by CountErrors and plugin callers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts An unknown severity does not silently become a successful build, and native lint category is not replaced by a fixture answer.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the build-total predicate and plugin gating purpose following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This diagnostic-category decision crosses no native boundary.
// @evidenceExclude contracts/performance.md#efficient-algorithms One category predicate does not choose an input-processing algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The predicate coordinates no shared computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Category inspection acquires or retains no resources.
func (d Diagnostic) IsError() bool {
  if d.lint != nil {
    return d.lint.IsError()
  }
  return d.Severity != SeverityWarning
}

// NewLintDiagnostic shapes a plugin finding so it renders alongside tsgo
// diagnostics with full color / source context. `pos` and `end` are byte
// offsets into the source file; `code` is a stable rule identifier (e.g. the
// rule's enum index). Severity controls both the rendered banner color and
// the exit-code outcome.
//
// @evidence contracts/common.md#principled-implementation The native lint anchor uses byte spans and category while the plain fields retain the same source and one-based byte location for structured consumers.
// @evidence contracts/common.md#clear-and-simple-design One constructor associates native rendering and public diagnostic data instead of a separate plugin rendering path.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing source context remains unlocated and supplied rule identifiers are preserved without fixture-based rewriting.
// @evidence contracts/common.md#meaningful-documentation Native prose states byte units, rule identifier and severity effects following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A supplied compiler source is inspected without resolving native filesystem identity or launching a process.
// @evidenceExclude contracts/performance.md#efficient-algorithms This adapter delegates span and line mapping to native diagnostic/scanner APIs.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Constructing one finding does not coordinate repeated diagnostic requests.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The result transfers its rendering anchor to the consumer without constructor-owned historical storage.
func NewLintDiagnostic(
  file *ast.SourceFile,
  pos, end int,
  code int32,
  severity Severity,
  message string,
) Diagnostic {
  cat := shimdiagnosticwriter.LintCategoryError
  if severity == SeverityWarning {
    cat = shimdiagnosticwriter.LintCategoryWarning
  }
  lint := shimdiagnosticwriter.NewLintDiagnostic(file, pos, end, code, cat, message)
  d := Diagnostic{
    Code:     code,
    Message:  message,
    Severity: severity,
    lint:     lint,
  }
  if file != nil {
    pos = lint.Pos()
    d.File = file.FileName()
    length := lint.Len()
    d.Start = &pos
    d.Length = &length
    line, col := shimscanner.GetECMALineAndByteOffsetOfPosition(file, pos)
    d.Line = line + 1
    d.Column = col + 1
  }
  return d
}

// SourceFile returns the program source file matching filename. Like
// SourceFiles, it applies linked ProgramPlugins first so a single-file
// consumer (e.g. a host's --file transform lane) sees the same mutated tree
// as a whole-project walk.
// Paths are resolved against the compiler's project directory and canonicalized
// with its actual case policy through the compiler's resident file index.
//
// @evidence contracts/common.md#principled-implementation The compiler's indexed lookup applies its project anchor and case policy, while the latched plugin pass keeps single-file reads consistent with whole-program consumers.
// @evidence contracts/common.md#clear-and-simple-design Lookup delegates source identity to the compiler instead of maintaining a second driver index.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing sources remain nil; no relative-name exception or repeated linear fallback guesses a match.
// @evidence contracts/common.md#meaningful-documentation Native prose describes canonical lookup, plugin ordering and the accessor's no-error channel under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation GetSourceFile canonicalizes against the current compiler's actual filesystem case policy and project directory.
// @evidence contracts/performance.md#efficient-algorithms Path normalization depends on filename length, followed by the upstream map lookup instead of scanning every resident source.
// @evidence contracts/performance.md#reuse-equivalent-work The current TSProgram owns an existing file index; an incremental replacement automatically supplies its updated index without a duplicate cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This borrowed-source accessor acquires no resource and adds no historical retained state.
func (p *Program) SourceFile(filename string) *ast.SourceFile {
  if p == nil || p.TSProgram == nil {
    return nil
  }
  // Discarded on purpose: an accessor returning a source file has no channel
  // for an apply failure, and growing one would ripple through every caller.
  // `Diagnostics` reports it, and the emit path checks the error directly.
  _ = p.ApplyLinkedPlugins()
  return p.TSProgram.GetSourceFile(filename)
}

// String returns a `path:line:col: message` formatted string.
//
// @evidence contracts/common.md#principled-implementation Located diagnostics include available line and column; unlocated findings retain just their message rather than invented coordinates.
// @evidence contracts/common.md#clear-and-simple-design One formatter handles the three available-location shapes without a renderer dependency.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Formatting uses supplied location fields and introduces no fixture-specific text.
// @evidence contracts/common.md#meaningful-documentation Native prose states the displayed shape following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This formatter displays an existing source name and performs no native path resolution.
// @evidenceExclude contracts/performance.md#efficient-algorithms Ordinary diagnostic formatting selects no input-processing algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Formatting one value does not coordinate shared computation requests.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned string transfers to its caller without formatter-owned state or handles.
func (d Diagnostic) String() string {
  if d.File == "" {
    return d.Message
  }
  if d.Line > 0 {
    return fmt.Sprintf("%s:%d:%d: %s", d.File, d.Line, d.Column, d.Message)
  }
  return fmt.Sprintf("%s: %s", d.File, d.Message)
}

// WritePrettyDiagnostics renders diagnostics with TypeScript-style colors,
// source snippets and the trailing error summary when raw tsgo or lint
// diagnostic objects are available. Mixed batches (e.g. typecheck + lint)
// are rendered through the same color/context pipeline; entries without
// either anchor fall back to the legacy `path:line:col: message` form.
//
// @evidence contracts/common.md#principled-implementation Rich anchors go through the native mixed diagnostic writer; unlocated generated findings stay on the plain path with an explicit missing-authored-location explanation.
// @evidence contracts/common.md#clear-and-simple-design One boundary classifies the batch and delegates native context rendering, preserving a plain fallback only for absent rendering anchors.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The plain path serves real unlocated diagnostics rather than masking a native source-position failure with a guessed range.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes mixed rich rendering and location-free output under documentation-skill guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Supplied streams and diagnostic source names are rendered without native filesystem or process access.
// @evidence contracts/performance.md#efficient-algorithms One O(N) classification pass and one rich-batch collection pass feed the native writer; temporary references grow linearly with batch size.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each invocation writes observable output and does not coordinate equivalent requests.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns w; this renderer never closes it or retains the batch after returning.
func WritePrettyDiagnostics(w io.Writer, diagnostics []Diagnostic, cwd string) {
  if len(diagnostics) == 0 {
    return
  }
  rich := make([]Diagnostic, 0, len(diagnostics))
  plain := make([]Diagnostic, 0)
  for _, d := range diagnostics {
    if d.raw != nil && d.raw.File() != nil && d.raw.Pos() < 0 {
      plain = append(plain, d)
    } else if d.raw != nil || d.lint != nil {
      rich = append(rich, d)
    } else {
      plain = append(plain, d)
    }
  }
  if len(rich) > 0 {
    astDiags := make([]*ast.Diagnostic, 0, len(rich))
    lintDiags := make([]*shimdiagnosticwriter.LintDiagnostic, 0, len(rich))
    for _, d := range rich {
      if d.raw != nil {
        astDiags = append(astDiags, d.raw)
      }
      if d.lint != nil {
        lintDiags = append(lintDiags, d.lint)
      }
    }
    shimdiagnosticwriter.FormatMixedDiagnostics(w, astDiags, lintDiags, cwd)
  }
  for _, d := range plain {
    severity := "error"
    if d.Severity == SeverityWarning {
      severity = "warning"
    }
    code := ""
    if d.Code != 0 {
      code = fmt.Sprintf(" TS%d", d.Code)
    }
    fmt.Fprintf(w, "  - %s%s: %s\n", severity, code, d.String())
    if d.raw != nil && d.raw.File() != nil && d.raw.Pos() < 0 {
      fmt.Fprintln(w, "    Diagnostic refers to generated code; no authored source location is available.")
    }
  }
}

// CountErrors returns the number of diagnostics that should fail the build.
// tsgo diagnostics carry their own `Error` category; lint diagnostics carry a
// caller-set Severity. Anything that isn't an explicit warning counts.
//
// @evidence contracts/common.md#principled-implementation Counting uses IsError for each element, so aggregate build status and individual plugin gating share the same native lint and warning policy.
// @evidence contracts/common.md#clear-and-simple-design One reduction delegates classification to its owning predicate rather than duplicating category rules.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No diagnostic family or known message is bypassed to make a build pass.
// @evidence contracts/common.md#meaningful-documentation Native prose states counted severity and producer distinctions under documentation-skill guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Counting categories performs no native filesystem or process operation.
// @evidence contracts/performance.md#efficient-algorithms One O(N) pass counts N diagnostics with constant temporary storage and no filtered intermediate slice.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This batch reduction coordinates no cache or in-flight request sharing.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The batch is borrowed and no diagnostic references are retained.
func CountErrors(diagnostics []Diagnostic) int {
  n := 0
  for _, d := range diagnostics {
    if d.IsError() {
      n++
    }
  }
  return n
}

// Program groups one compiler instance, its borrowed checker and the filesystem
// and configuration that produced it. Call Close when the checker lease is no
// longer needed; callers must not release Checker independently.
//
// @evidence contracts/common.md#principled-implementation Compiler, checker, config and filesystem stay associated with one loaded generation; plugin state records that generation's mutations and failures.
// @evidence contracts/common.md#clear-and-simple-design The facade groups generation state while load, diagnostics, emit and plugin application retain separate operations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Upstream objects and owned plugin state are represented directly without replacing checker methods or pretending a failed hook succeeded.
// @evidence contracts/common.md#meaningful-documentation Native prose and member comments state generation association and checker lease ownership under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation FS and Host carry the supplied filesystem capabilities; the type stores no OS-name-based path or case rule.
// @evidenceExclude contracts/performance.md#efficient-algorithms This state type does not choose the algorithms implemented by its load and emit operations.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The representation does not independently decide equivalence of compiler generations.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Resource acquisition and release are performed by LoadProgram and Close rather than the data representation.
type Program struct {
  // TSProgram is the current upstream compiler generation.
  TSProgram *shimcompiler.Program

  // ParsedConfig retains the resolved project and compiler options.
  ParsedConfig *tsoptions.ParsedCommandLine

  // Checker is borrowed under the lease released by Close.
  Checker        *shimchecker.Checker
  checkerRelease func()

  // Host is the compiler host for this generation.
  Host shimcompiler.CompilerHost

  // FS is the input-observing filesystem, including any source preamble layer.
  FS            vfs.FS
  inputObserver *inputObservationFS

  // SourcePreamble is the injected text used when correcting authored positions.
  SourcePreamble  string
  plugins         linkedPluginState
  pluginsApplied  bool
  pluginsApplyErr error
}

// LoadProgramOptions controls tsconfig overrides applied before tsgo creates
// the program. `ForceEmit` is used by `ttsc --emit` and runtime compilation
// so execution still works when the project defaults to `noEmit`.
//
// @evidence contracts/common.md#principled-implementation Explicit overrides and an optional FS represent caller-owned load choices separately from resolved tsconfig values.
// @evidence contracts/common.md#clear-and-simple-design One options value carries load-time choices; compiler option merging stays with LoadProgram and the native parser.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Dedicated fields express supported overrides without deriving policy from a fixture or consumer name.
// @evidence contracts/common.md#meaningful-documentation Native member prose explains force emit, semantic config ownership, threading and optional FS under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation FS supplies native capabilities and path fields retain caller spellings for the loader's supported normalization boundary.
// @evidenceExclude contracts/performance.md#efficient-algorithms Options encode choices but perform no compilation algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This input value does not establish whether loaded work can be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The value does not acquire or release the filesystem or checker resources it references.
type LoadProgramOptions struct {
  // ForceEmit clears noEmit and emitDeclarationOnly for this load.
  ForceEmit bool

  // ForceNoEmit enables analysis without file writes.
  ForceNoEmit bool

  // OutDir overrides the output directory after resolution against cwd.
  OutDir string

  // SemanticConfigPath restores the user-authored config as the semantic
  // project owner after parsing a disposable generated wrapper. Native command
  // entry points set it explicitly; nested driver calls do not inherit it.
  SemanticConfigPath string

  // SourcePreamble is prepended to eligible source files before parsing.
  SourcePreamble string

  // SingleThreaded forces TypeScript-Go's single-threaded mode (one checker,
  // serial parse/check/emit), mirroring `tsgo --singleThreaded`.
  SingleThreaded bool

  // Checkers overrides the type-checker pool size, mirroring `tsgo --checkers`.
  // Zero leaves TypeScript-Go's default; ignored when SingleThreaded is set.
  Checkers int

  // TsgoArgs carries tsgo CLI flags the `ttsc` launcher did not recognize as
  // its own (`--strict`, `--target es2020`, …). They are parsed through
  // TypeScript-Go's own command-line parser into a CompilerOptions overlay
  // that wins over the tsconfig, exactly as `tsgo`'s CLI merges them.
  // A nil slice uses the launcher environment; an empty non-nil slice forwards
  // no flags even when an ancestor process published an environment value.
  TsgoArgs []string

  // FS overrides the filesystem the program is built on. When nil, DefaultFS
  // is used. A resident Session passes an overlay FS so in-memory edits stay
  // visible to the program and to incremental UpdateProgram calls.
  FS vfs.FS
}

// Close releases the checker pool lease acquired by LoadProgram.
//
// @evidence contracts/common.md#principled-implementation The recorded release callback returns the checker lease once and is cleared after release.
// @evidence contracts/common.md#clear-and-simple-design Checker ownership has one cleanup operation instead of independent releases by each consumer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Cleanup invokes the owned callback rather than patching the checker pool or fabricating success after another operation fails.
// @evidence contracts/common.md#meaningful-documentation Native prose names the lease acquired by LoadProgram following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker release is an in-process pool operation without native path or process representation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Releasing one recorded lease involves no input-processing algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Pool lease cleanup does not determine whether compiler outputs may be reused.
// @evidence contracts/performance.md#bound-retention-and-release-resources Program owns one checker lease, clears its release callback on Close and leaves facade memory lifetime to the caller; repeated Close does not release twice.
func (p *Program) Close() error {
  if p.checkerRelease != nil {
    p.checkerRelease()
    p.checkerRelease = nil
  }
  return nil
}

// ParseTSConfig parses a tsconfig.json file via tsgo's native JSONC parser.
// Comments, trailing commas, and `extends` chains are handled automatically.
//
// The absolute path is resolved against cwd before any VFS lookups because
// tsgo's filesystem APIs require absolute paths — mirrors what tsc does when
// you pass a relative `--project` flag.
//
// cliOptions is a CompilerOptions overlay (from forwarded `tsgo` CLI flags);
// TypeScript-Go merges its non-zero fields over the tsconfig so the CLI wins,
// the same precedence tsgo's own command line uses. Pass nil for none. A
// struct cannot carry a reset such as `--declarationDir null`; LoadProgram
// parses forwarded flags itself and merges them with their raw options.
//
// @evidence contracts/common.md#principled-implementation The native JSONC parser handles extends and merges compiler options; normalized absolute project paths meet the VFS input requirement.
// @evidence contracts/common.md#clear-and-simple-design This public adapter delegates to the same private parser used by LoadProgram, with no second config-merge policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Native parse diagnostics are returned instead of accepting a partial config or special-casing project files.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state JSONC support, path anchoring and the struct-overlay reset limitation under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation tspath resolves the config against cwd; the supplied FS and host own native file access and case behavior.
// @evidenceExclude contracts/performance.md#efficient-algorithms The adapter selects the supported native parser rather than implementing a separate parsing algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This parse invocation coordinates no completed or in-flight config cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The supplied filesystem and host are borrowed; returned config and diagnostics become caller-owned values.
func ParseTSConfig(fs vfs.FS, cwd, tsconfigPath string, host shimcompiler.CompilerHost, cliOptions *core.CompilerOptions) (*tsoptions.ParsedCommandLine, []Diagnostic, error) {
  return parseTSConfig(fs, cwd, tsconfigPath, host, cliOptions, nil)
}

// parseTSConfig is ParseTSConfig with the parsed forwarded command line, when
// there is one, beside its merged options.
//
// TypeScript-Go's own command line hands the config merge both the parsed
// CompilerOptions and the options the command line spelled out. The raw half
// is what carries a reset: `--declarationDir null` leaves the parsed field at
// its zero value, which the merge reads as "not given", so without it the
// config's own location survives. ttsc forwards exactly these resets to keep a
// private build's outputs in one directory (`isolatedTsgoOutputArgs`).
func parseTSConfig(fs vfs.FS, cwd, tsconfigPath string, host shimcompiler.CompilerHost, cliOptions *core.CompilerOptions, commandLine *tsoptions.ParsedCommandLine) (*tsoptions.ParsedCommandLine, []Diagnostic, error) {
  resolved := tspath.ResolvePath(cwd, tsconfigPath)
  if !fs.FileExists(resolved) {
    return nil, nil, fmt.Errorf("tsconfig not found: %s", resolved)
  }
  if cliOptions == nil {
    cliOptions = &core.CompilerOptions{}
  }
  parsed, diags := tsoptions.GetParsedCommandLineOfConfigFile(resolved, cliOptions, tsoptions.CommandLineRawOptions(commandLine), host, nil)
  allDiags := diags
  if parsed != nil {
    // Read failures are returned separately; recoverable JSON syntax errors
    // belong to the parsed source before its option-conversion diagnostics.
    allDiags = append(allDiags, parsed.GetConfigFileParsingDiagnostics()...)
  }
  if len(allDiags) > 0 {
    return nil, convertDiagnostics(allDiags), nil
  }
  return parsed, nil, nil
}

// resolveTsgoArgs picks the forwarded tsgo argv for this load: the caller's
// explicit LoadProgramOptions.TsgoArgs when it has one, otherwise whatever the
// launcher published in TsgoArgsEnv.
//
// The explicit value wins so a host that declares its own `--tsgo-args` flag
// (cmd/ttsc, the utility host, @ttsc/lint) keeps deciding for itself, and an
// embedder that deliberately passes an empty argv is not overridden by an
// environment variable an ancestor ttsc process happened to set. The fallback
// is what carries the payload into a third-party sidecar whose flag set does
// not declare `--tsgo-args` at all — see TsgoArgsEnv.
func resolveTsgoArgs(explicit []string) ([]string, error) {
  if explicit != nil {
    return explicit, nil
  }
  return TsgoArgsFromEnv()
}

// parseTsgoArgs runs forwarded tsgo CLI flags through TypeScript-Go's own
// command-line parser, yielding the parsed command line whose options
// parseTSConfig merges over the tsconfig. This is how a plugin build — which
// constructs its Program in-process rather than shelling out to `tsgo` — still
// honors flags like `ttsc --strict`. Returns (nil, nil, nil) when there are no
// forwarded flags.
func parseTsgoArgs(args []string, host shimcompiler.CompilerHost) (*tsoptions.ParsedCommandLine, []Diagnostic, error) {
  if len(args) == 0 {
    return nil, nil, nil
  }
  cli := tsoptions.ParseCommandLine(args, host)
  if cli == nil {
    return nil, nil, fmt.Errorf("driver: tsgo argument parser returned nil")
  }
  if len(cli.Errors) > 0 {
    return nil, convertDiagnostics(cli.Errors), nil
  }
  return cli, nil, nil
}

// CreateProgramFromConfig builds a tsgo Program from the parsed config.
//
// SingleThreaded is intentionally left unset so the program keeps
// TypeScript-Go's parallel source parsing and parallel emit. The checker
// pool, however, is pinned to a single checker (see forceSingleChecker):
// every phase ttsc layers on top — plugin transforms and the output
// rewriter — walks the program serially against the one checker returned by
// Program.GetTypeChecker, and then asks that checker to resolve types in
// nodes drawn from *every* source file. TypeScript-Go's multi-checker pool
// affinitizes each file to a different checker and forbids mixing types
// across them; a circular type whose declarations span files on different
// checkers resolves to `any` on the borrowed checker. Pinning the pool to
// one checker keeps prog.Checker consistent with how every file was checked
// while leaving parse and emit parallel. Both EmitAll and EmitAllRaw
// serialize the WriteFile callback under a mutex so the emit-stage rewriter
// never observes the parallel emit either.
//
// @evidence contracts/common.md#principled-implementation Native Program construction uses parsed config and source project references; one checker keeps cross-file type queries in the same checker affinity.
// @evidence contracts/common.md#clear-and-simple-design The adapter owns only Program options and checker-affinity policy while upstream owns parsing and compiler construction.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The checker count is a stated cross-file correctness constraint, not a benchmark-only cap or consumer-specific workaround.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain preserved parallel parsing/emit and the single-checker reason under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation The supplied CompilerHost provides native filesystem capabilities and project anchoring without an OS-name-derived policy.
// @evidenceExclude contracts/performance.md#efficient-algorithms Program construction delegates to the compiler's native algorithm; this adapter imposes the checker affinity required by its consumers.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Construction creates a new compiler generation and does not coordinate reuse across callers.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned native Program transfers to its caller; acquiring a checker lease is a later LoadProgram responsibility.
func CreateProgramFromConfig(parsed *tsoptions.ParsedCommandLine, host shimcompiler.CompilerHost) (*shimcompiler.Program, []Diagnostic, error) {
  if parsed == nil {
    return nil, nil, fmt.Errorf("driver: nil parsed command line")
  }
  forceSingleChecker(parsed)
  opts := shimcompiler.ProgramOptions{
    Config:                      parsed,
    Host:                        host,
    UseSourceOfProjectReference: true,
  }
  p := shimcompiler.NewProgram(opts)
  if p != nil {
    e2etrace.Program("program-construction", "driver-create", "constructor-returned", false, p)
  }
  return p, nil, nil
}

// forceSingleChecker pins the TypeScript-Go checker pool to a single checker.
//
// ttsc's transform and rewrite phases run serially and obtain types through
// the single checker that Program.GetTypeChecker hands back. Those phases
// query types on nodes from arbitrary source files, so the checker must be
// the same one that checked every file. A pool of size > 1 affinitizes files
// to distinct checkers; resolving a type whose declarations cross that
// boundary (e.g. a circular indexed-access alias) yields `any`. Parallel
// parsing and emit are unaffected — they do not consult the checker count.
func forceSingleChecker(parsed *tsoptions.ParsedCommandLine) {
  options := parsed.ParsedConfig.CompilerOptions
  if options.SingleThreaded == core.TSTrue {
    return
  }
  one := 1
  options.Checkers = &one
}

// LoadProgram is the one-shot convenience used by `ttsc`.
// It parses the tsconfig, creates a program and a type-checker, and returns
// the wrapped facade.
//
// cwd must be absolute; tsconfigPath may be relative to cwd.
//
// @evidence contracts/common.md#principled-implementation Plugin preambles enter before parsing, native CLI/config merging resolves options before Program creation, and the facade records the exact filesystem observations and checker for that generation.
// @evidence contracts/common.md#clear-and-simple-design One loader orders plugin config, filesystem layers, config overrides and checker acquisition; private helpers each own one policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid configuration or CLI input returns before construction; an explicitly empty argument list does not fall through to an ancestor's flags.
// @evidence contracts/common.md#meaningful-documentation Native prose and options document one-shot load, path anchoring, force overrides and checker ownership under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation Native cwd resolution uses filepath/tspath and the chosen VFS provides actual case and path capabilities; semantic wrapper ownership uses an explicit config path.
// @evidence contracts/performance.md#efficient-algorithms One load composes filesystem observation with native parsing/checker creation; byte hashing covers read content once per observation rather than a post-load project scan.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This one-shot factory does not coordinate callers; Session and resident hosts own cross-request compiler reuse.
// @evidence contracts/performance.md#bound-retention-and-release-resources Errors before acquisition return no lease; success transfers the acquired checker lease and generation state to Program, whose Close releases it.
func LoadProgram(cwd, tsconfigPath string, options LoadProgramOptions) (*Program, []Diagnostic, error) {
  if !filepath.IsAbs(cwd) {
    if abs, err := filepath.Abs(cwd); err == nil {
      cwd = abs
    }
  }
  cwd = tspath.ResolvePath(cwd)
  pluginState, err := loadLinkedPluginState(cwd, tsconfigPath)
  if err != nil {
    return nil, nil, err
  }
  preamble, err := pluginState.sourcePreamble()
  if err != nil {
    return nil, nil, err
  }
  if preamble != "" {
    options.SourcePreamble += preamble
  }
  fs := options.FS
  if fs == nil {
    fs = DefaultFS()
  }
  inputObserver := newInputObservationFS(fs)
  fs = inputObserver
  if options.SourcePreamble != "" {
    fs = sourcePreambleFS{
      FS:       fs,
      preamble: options.SourcePreamble,
    }
  }
  host := DefaultHost(cwd, fs)

  tsgoArgs, err := resolveTsgoArgs(options.TsgoArgs)
  if err != nil {
    return nil, nil, err
  }
  commandLine, cliDiags, err := parseTsgoArgs(tsgoArgs, host)
  if err != nil {
    return nil, nil, err
  }
  if len(cliDiags) > 0 {
    return nil, cliDiags, nil
  }

  parsed, diags, err := parseTSConfig(fs, cwd, tsconfigPath, host, commandLine.CompilerOptions(), commandLine)
  if err != nil {
    return nil, nil, err
  }
  if len(diags) > 0 {
    return nil, diags, nil
  }
  if err := applySemanticConfigPath(parsed, options.SemanticConfigPath); err != nil {
    return nil, nil, err
  }
  if options.ForceNoEmit {
    forceNoEmit(parsed)
  }
  if options.ForceEmit {
    forceEmit(parsed)
  }
  if options.OutDir != "" {
    overrideOutDir(cwd, parsed, options.OutDir)
  }
  applyThreadingOptions(parsed, options.SingleThreaded, options.Checkers)

  tsProgram, _, _ := CreateProgramFromConfig(parsed, host)

  checker, done := tsProgram.GetTypeChecker(context.Background())
  prog := &Program{
    TSProgram:      tsProgram,
    ParsedConfig:   parsed,
    Checker:        checker,
    checkerRelease: done,
    Host:           host,
    FS:             fs,
    inputObserver:  inputObserver,
    SourcePreamble: options.SourcePreamble,
  }
  prog.plugins = pluginState
  e2etrace.Program("program-load-outcome", "driver-create", "facade-installed", false, tsProgram)
  return prog, nil, nil
}

func applySemanticConfigPath(parsed *tsoptions.ParsedCommandLine, semanticConfigPath string) error {
  configured := strings.TrimSpace(semanticConfigPath)
  if configured == "" {
    return nil
  }
  if !filepath.IsAbs(configured) {
    return fmt.Errorf("driver: semantic config path must be absolute: %s", configured)
  }
  parsed.ParsedConfig.CompilerOptions.ConfigFilePath = tspath.ResolvePath(configured)
  return nil
}

// forceEmit clears noEmit and emitDeclarationOnly so the program always
// produces JavaScript output regardless of the tsconfig settings.
func forceEmit(parsed *tsoptions.ParsedCommandLine) {
  options := parsed.ParsedConfig.CompilerOptions
  options.NoEmit = core.TSFalse
  options.EmitDeclarationOnly = core.TSFalse
}

// forceNoEmit sets noEmit so the program type-checks without writing files.
func forceNoEmit(parsed *tsoptions.ParsedCommandLine) {
  parsed.ParsedConfig.CompilerOptions.NoEmit = core.TSTrue
}

// overrideOutDir resolves outDir against cwd and applies it to the parsed
// config, replacing any outDir already set in tsconfig.json.
func overrideOutDir(cwd string, parsed *tsoptions.ParsedCommandLine, outDir string) {
  parsed.ParsedConfig.CompilerOptions.OutDir = tspath.ResolvePath(cwd, outDir)
}

// applyThreadingOptions forwards the CLI threading knobs onto the parsed
// compiler options. ttsc mirrors tsgo here: `--singleThreaded` / `--checkers`
// land in CompilerOptions, and both Program.SingleThreaded() and the checker
// pool read them from there — ProgramOptions is left untouched, exactly as
// tsgo's own CLI does. SingleThreaded wins over Checkers, matching the pool's
// own precedence.
//
// Note that CreateProgramFromConfig calls forceSingleChecker afterwards, so a
// `--checkers N` greater than 1 is recorded here but then clamped back to a
// single checker: ttsc's serial transform/rewrite phases require one checker
// (see forceSingleChecker). `--singleThreaded` still takes full effect.
func applyThreadingOptions(parsed *tsoptions.ParsedCommandLine, singleThreaded bool, checkers int) {
  options := parsed.ParsedConfig.CompilerOptions
  if singleThreaded {
    options.SingleThreaded = core.TSTrue
  }
  if checkers > 0 {
    n := checkers
    options.Checkers = &n
  }
}

// sourcePreambleFS wraps a vfs.FS and prepends the preamble string to every
// source file read by tsgo's parser. Declaration files (.d.ts etc.) are
// excluded so injected code never appears in type definitions.
type sourcePreambleFS struct {
  vfs.FS
  preamble string
}

func (fs sourcePreambleFS) ReadFile(filePath string) (string, bool) {
  contents, ok := fs.FS.ReadFile(filePath)
  if !ok {
    return contents, ok
  }
  return ApplySourcePreambleToFile(filePath, contents, fs.preamble), true
}

// isSourcePreambleTarget reports whether the preamble should be injected into
// the file at filePath. Declaration files are excluded; all other TypeScript
// and JavaScript source extensions qualify.
func isSourcePreambleTarget(filePath string) bool {
  lower := strings.ToLower(filepath.ToSlash(filePath))
  for _, suffix := range []string{".d.ts", ".d.mts", ".d.cts"} {
    if strings.HasSuffix(lower, suffix) {
      return false
    }
  }
  for _, suffix := range []string{".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"} {
    if strings.HasSuffix(lower, suffix) {
      return true
    }
  }
  return false
}

// ApplySourcePreambleToFile applies a generated preamble only when filePath is
// a non-declaration TypeScript or JavaScript source, matching sourcePreambleFS.
//
// @evidence contracts/common.md#principled-implementation The shared eligibility predicate makes direct insertion match the parsing filesystem wrapper.
// @evidence contracts/common.md#clear-and-simple-design One predicate delegates to the byte-preserving insertion operation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler source extensions replace fixture filenames or parser mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies declaration exclusion and wrapper correspondence following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation filepath.ToSlash normalizes native separators without assuming a host separator.
// @evidence contracts/performance.md#efficient-algorithms A fixed extension set is checked before allocating inserted text.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work One source operation owns no repeated-work coordinator.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned string is caller-owned without a resident collection or resource.
func ApplySourcePreambleToFile(filePath string, text string, preamble string) string {
  if !isSourcePreambleTarget(filePath) {
    return text
  }
  return ApplySourcePreamble(text, preamble)
}

// ApplySourcePreamble inserts a generated source preamble without moving the
// file's BOM or hashbang away from the first bytes of the physical output.
//
// @evidence contracts/common.md#principled-implementation BOM and hashbang positions remain lexical prefixes ahead of injected bytes.
// @evidence contracts/common.md#clear-and-simple-design Empty, BOM, and hashbang branches construct the resulting text directly.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Source markers replace hardcoded filenames or compiler-internal mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose states the physical-byte guarantee following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Source-byte insertion performs no native operation.
// @evidence contracts/performance.md#efficient-algorithms Prefix checks and one newline search precede direct concatenation without reparsing the source.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each requested source value has no shared-work ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the returned string is retained by its caller.
func ApplySourcePreamble(text string, preamble string) string {
  if preamble == "" {
    return text
  }
  bom := ""
  rest := text
  if strings.HasPrefix(rest, "\ufeff") {
    bom = "\ufeff"
    rest = strings.TrimPrefix(rest, "\ufeff")
  }
  if strings.HasPrefix(rest, "#!") {
    end := strings.IndexByte(rest, '\n')
    if end < 0 {
      return bom + rest + "\n" + preamble
    }
    return bom + rest[:end+1] + preamble + rest[end+1:]
  }
  return bom + preamble + rest
}

// SourceFiles exposes the program's resident non-declaration source files.
// Imported implementation files from source-distributed dependencies can be
// present; consumers that need project-owned files must apply their own root
// predicate.
//
// @evidence contracts/common.md#principled-implementation Resident dependency sources remain distinct from project-owned files.
// @evidence contracts/common.md#clear-and-simple-design One hook owner runs before one declaration-file filter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler files replace guessed directory exclusions or fabricated entries.
// @evidence contracts/common.md#meaningful-documentation Native prose explains declaration filtering and caller ownership following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Resident AST enumeration performs no native operation.
// @evidence contracts/performance.md#efficient-algorithms One pass collects non-declaration sources.
// @evidence contracts/performance.md#reuse-equivalent-work The generation-wide hook latch prevents repeated transformation during enumeration.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The result borrows program ASTs without another cache or resource.
func (p *Program) SourceFiles() []*ast.SourceFile {
  // Discarded on purpose; see SourceFile. `Diagnostics` carries the failure.
  _ = p.ApplyLinkedPlugins()
  return p.sourceFilesRaw()
}

// sourceFilesRaw returns the program's non-declaration source files without
// running ApplyLinkedPlugins. Used internally to avoid a re-entrant apply.
func (p *Program) sourceFilesRaw() []*ast.SourceFile {
  out := make([]*ast.SourceFile, 0)
  if p == nil || p.TSProgram == nil {
    return out
  }
  for _, f := range p.TSProgram.SourceFiles() {
    if f.IsDeclarationFile {
      continue
    }
    out = append(out, f)
  }
  return out
}

// ApplyLinkedPlugins runs registered linked ProgramPlugin hooks exactly once.
// A hook failure is latched and returned on every subsequent call: SourceFiles
// swallows the error by contract, so without the latch a lookup that happened
// to run first would consume the only report and let a later emit proceed over
// the half-applied program as if nothing failed.
//
// @evidence contracts/common.md#principled-implementation Success and failure are generation-wide outcomes shared by all later consumers.
// @evidence contracts/common.md#clear-and-simple-design One applied bit and stored error define the once-only transition.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Failure is neither retried through compensating mutations nor converted to later success.
// @evidence contracts/common.md#meaningful-documentation Native prose explains latching and lookup/emit consequences following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Hook scheduling performs no native path operation.
// @evidence contracts/performance.md#efficient-algorithms Subsequent calls return the stored result in constant time.
// @evidence contracts/performance.md#reuse-equivalent-work Setting the bit before dispatch prevents reentrant or later repeated mutation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The stored outcome expires with its Program generation.
func (p *Program) ApplyLinkedPlugins() error {
  if p == nil {
    return nil
  }
  if p.pluginsApplied {
    return p.pluginsApplyErr
  }
  p.pluginsApplied = true
  p.pluginsApplyErr = p.plugins.apply(p)
  return p.pluginsApplyErr
}

// HasLinkedProgramPlugins reports whether the loaded project has an active
// ProgramPlugin. Those hooks mutate parsed ASTs in place and therefore require
// a fresh Program rather than Session's incremental source replacement.
//
// @evidence contracts/common.md#principled-implementation Registered mutation capability distinguishes fresh-program work from incremental checking.
// @evidence contracts/common.md#clear-and-simple-design A guarded delegation preserves one classification owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Actual interfaces replace package-name or test-case classification.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the fresh-generation requirement following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Registry inspection performs no native boundary operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Registry classification owns iteration; this function forwards the result.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This predicate owns no shared-work coordinator.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No retained state or resource is created.
func (p *Program) HasLinkedProgramPlugins() bool {
  return p != nil && p.plugins.hasProgramPlugins()
}

// PluginHostInputs returns the generation-wide native configuration files
// reported by linked plugins while this Program was loaded or transformed.
//
// @evidence contracts/common.md#principled-implementation Hook observations form a generation-wide union even when multiple hooks report one file.
// @evidence contracts/common.md#clear-and-simple-design The ledger owns union and ordering rather than a second dependency collection.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Recorded inputs replace guessed plugin files or weakened unknown observations.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies input scope and lifetime following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Already recorded paths are returned without new native resolution.
// @evidenceExclude contracts/performance.md#efficient-algorithms The delegated ledger owns union and ordering.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This accessor has no independent shared-work coordinator.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The snapshot is caller-owned without another retained cache.
func (p *Program) PluginHostInputs() []string {
  if p == nil {
    return nil
  }
  return p.plugins.hostInputs()
}

// PluginHostInputHashes returns evaluation-time fingerprints for the subset of
// native host inputs whose exact state plugins reported without conflict.
//
// @evidence contracts/common.md#principled-implementation Unknown and conflicting observations remain absent from reusable content proof.
// @evidence contracts/common.md#clear-and-simple-design One ledger projection retains one proof-merging owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Later filesystem reads cannot replace evaluation-time observations.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes proven and complete input sets following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Observation exposure performs no native path resolution or filesystem access.
// @evidenceExclude contracts/performance.md#efficient-algorithms The ledger owns proof merging and snapshot allocation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This accessor exposes proof without deciding reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Copied results create no additional resident collection.
func (p *Program) PluginHostInputHashes() map[string]*string {
  if p == nil {
    return nil
  }
  return p.plugins.hostInputHashes()
}

// PluginHostInputRealpaths returns evaluation-time physical identities for the
// subset of native host inputs whose symlink or junction target was observed
// without conflict.
//
// @evidence contracts/common.md#principled-implementation Physical identity requires consistent observations from every reporting scope.
// @evidence contracts/common.md#clear-and-simple-design The ledger owns identity merging without accessor path reinterpretation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Lexical guesses or later observations cannot fill missing identity proof.
// @evidence contracts/common.md#meaningful-documentation Native prose explains evaluation-time symlink/junction identity following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The accessor exposes the ledger's existing native observations.
// @evidenceExclude contracts/performance.md#efficient-algorithms The ledger owns merging and copied results.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Identity exposure does not coordinate artifact work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No resource or independent cache is acquired.
func (p *Program) PluginHostInputRealpaths() map[string]*string {
  if p == nil {
    return nil
  }
  return p.plugins.hostInputRealpaths()
}

// PluginObservationsIncomplete reports whether any linked hook explicitly
// declared that its supported public API could not observe the input population
// for this generation. False means no such declaration, not completeness proof.
//
// This state does not replace individual hash or physical-path conflicts. Hosts
// may publish successful fresh output with this limitation but must not use it
// to admit an observed mutation or reusable narrow dependency population.
//
// @evidence contracts/common.md#principled-implementation The generation exposes the union of explicit per-hook unavailable-observation declarations, independently of individual content and physical identity proofs.
// @evidence contracts/common.md#clear-and-simple-design The hook ledger owns aggregation; the Program accessor only exposes its declared limitation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Neither absent declarations nor a successful fresh transform establish completeness, and the accessor does not remove actual conflict evidence.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs define the explicit signal, false-state meaning and fresh-output versus reuse distinction following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The accessor reads recorded hook state and performs no native path operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms The hook ledger owns bounded per-scope aggregation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This accessor reports a reuse limitation without owning artifact reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No resource or independent retained cache is created.
func (p *Program) PluginObservationsIncomplete() bool {
  return p != nil && p.plugins.inputs.hasIncompleteObservations()
}

// Diagnostics returns project diagnostics that must block compilation or
// runtime execution before any JavaScript is emitted or evaluated.
//
// @evidence contracts/common.md#principled-implementation Full diagnostics include latched failures without moving mutation hooks into the diagnostic query.
// @evidence contracts/common.md#clear-and-simple-design Nil file selection delegates to the shared aggregation owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fabricated success, retried transform, or extra mutation precedes diagnostics.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the pre-execution boundary following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Resident diagnostic queries perform no native filesystem operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shared pipeline owns queries, filtering, and deduplication.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Compiler checker state owns semantic reuse without an independent accessor cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the caller-owned result is created.
func (p *Program) Diagnostics() []Diagnostic {
  return p.diagnostics(nil)
}

// DiagnosticsForFiles returns diagnostics whose semantic work is restricted to
// selected source files, plus the program/global diagnostics that qualify the
// same immutable Program generation. The resident graph shard producer uses it
// for the compiler-invalidated closure; callers that need the complete project
// continue to use Diagnostics.
//
// @evidence contracts/common.md#principled-implementation Selected semantic work remains qualified by globals from the same generation.
// @evidence contracts/common.md#clear-and-simple-design Selection delegates to the existing aggregation policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Global findings and current-generation diagnostics are not replaced by narrower cached success.
// @evidence contracts/common.md#meaningful-documentation Native prose explains selection and complete-project alternatives following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Resident AST selection performs no native path resolution.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shared pipeline owns queries and deduplication.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The caller owns invalidated-closure selection; this method owns no cache validity decision.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller-owned result acquires no retained resource.
func (p *Program) DiagnosticsForFiles(files []*ast.SourceFile) []Diagnostic {
  return p.diagnostics(files)
}

func (p *Program) diagnostics(files []*ast.SourceFile) []Diagnostic {
  if p == nil || p.TSProgram == nil {
    return []Diagnostic{{Message: "driver: nil program"}}
  }
  // A linked ProgramPlugin that failed to apply is reported here, ahead of the
  // compiler's own findings, because every other consumer of this program is
  // then looking at a tree the plugin did not transform.
  //
  // `SourceFile`, `SourceFiles`, and the graph builder all run the apply and
  // discard its error — they have no channel of their own and are not the place
  // to grow one. The emit path checks it directly and fails the build, so this
  // is the read-only half of the same fact: graph consumers read the program
  // through this method, and without it they would describe the untransformed
  // tree while `ttsc build` on the same project reported the failure.
  //
  // The cached outcome is read, never forced. Calling `ApplyLinkedPlugins`
  // here would move WHEN the apply happens: diagnostics would then be computed
  // against the mutated tree, whose nodes carry positions that need not map
  // into the original source text, and the diagnostic writer walks that text to
  // render context. It panics on the mismatch.
  //
  // Reading the cache costs nothing and is enough for the consumers this is
  // for: `SourceTexts` and `SourceFiles` run the apply, and both graph entry
  // points call them before asking for diagnostics. A caller that has not
  // applied yet has nothing to report, which is correct — the plugins have not
  // failed, they have not run.
  //
  // `driver: nil program` above is the precedent for a driver-level entry with
  // no file or code.
  var out []Diagnostic
  if p.pluginsApplied && p.pluginsApplyErr != nil {
    out = append(out, Diagnostic{
      Severity: SeverityError,
      Message:  "driver: linked plugins failed to apply: " + p.pluginsApplyErr.Error(),
    })
  }
  ctx := context.Background()
  var raw []*ast.Diagnostic
  if files == nil {
    raw = shimcompiler.GetDiagnosticsOfAnyProgram(
      ctx,
      p.TSProgram,
      nil,
      false,
      p.TSProgram.GetBindDiagnostics,
      p.TSProgram.GetSemanticDiagnostics,
    )
  } else {
    for _, file := range files {
      raw = append(raw, shimcompiler.GetDiagnosticsOfAnyProgram(
        ctx,
        p.TSProgram,
        file,
        false,
        p.TSProgram.GetBindDiagnostics,
        p.TSProgram.GetSemanticDiagnostics,
      )...)
    }
  }
  raw = filterDiagnostics(raw)
  // filterDiagnostics runs first because it resolves a node from the position
  // tsgo recorded, which only makes sense against the tree tsgo parsed. The
  // preamble correction happens inside convertProgramDiagnostics, once the
  // positions are no longer used to look anything up.
  return append(out, p.convertProgramDiagnostics(shimcompiler.SortAndDeduplicateDiagnostics(raw))...)
}

// filterDiagnostics removes diagnostics that are false positives in ttsc's
// compilation model. Currently it suppresses unused type-parameter warnings
// on overload signatures that have no body (see isUnusedOverloadSignatureTypeParameterDiagnostic).
func filterDiagnostics(in []*ast.Diagnostic) []*ast.Diagnostic {
  out := in[:0]
  for _, d := range in {
    if isUnusedOverloadSignatureTypeParameterDiagnostic(d) {
      continue
    }
    out = append(out, d)
  }
  return out
}

// isUnusedOverloadSignatureTypeParameterDiagnostic reports true when the
// diagnostic is TS6196 ("unused declaration") or TS6205 ("all type parameters
// are unused") on a function declaration that has no body — i.e., an overload
// signature. tsgo fires these on overloads whose type parameters are used only
// in the implementation signature, which is a false positive: the overload
// signatures are required for narrowing and their type parameters are
// effectively forwarded to the implementation.
func isUnusedOverloadSignatureTypeParameterDiagnostic(d *ast.Diagnostic) bool {
  if d == nil || d.File() == nil {
    return false
  }
  switch d.Code() {
  case 6196, 6205: // unused declaration / all type parameters are unused
  default:
    return false
  }
  node := ast.GetNodeAtPosition(d.File(), d.Pos(), false)
  for node != nil {
    if node.Kind == ast.KindFunctionDeclaration {
      return node.Body() == nil
    }
    node = node.Parent
  }
  return false
}

// convertDiagnostics translates shim-specific diagnostics into the plain
// Diagnostic struct with line/column populated from tsgo's ECMA line model
// (shimscanner.GetECMALineAndByteOffsetOfPosition).
//
// Diagnostics produced by a Program go through convertProgramDiagnostics
// instead, which undoes a source preamble's position shift first.
func convertDiagnostics(in []*ast.Diagnostic) []Diagnostic {
  out := make([]Diagnostic, 0, len(in))
  for _, d := range in {
    if d == nil {
      continue
    }
    out = append(out, convertDiagnostic(d))
  }
  return out
}

// convertDiagnostic translates one shim diagnostic, taking its file, line, and
// column from whatever source file the diagnostic is anchored to.
func convertDiagnostic(d *ast.Diagnostic) Diagnostic {
  diag := Diagnostic{Code: d.Code(), Message: d.String(), raw: d}
  if file := d.File(); file != nil {
    diag.File = file.FileName()
    if pos := d.Pos(); pos >= 0 {
      length := d.Len()
      diag.Start = &pos
      diag.Length = &length
      line, col := shimscanner.GetECMALineAndByteOffsetOfPosition(file, pos)
      diag.Line = line + 1
      diag.Column = col + 1
    }
  }
  return diag
}
