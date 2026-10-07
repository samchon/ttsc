// Subcommand orchestration for the `@ttsc/lint` native binary.
//
// The plugin host shells out to this binary with one of three project
// commands (`check`, `build`, `transform`). Each shares the same setup:
// parse flags, bootstrap a Program + Checker (see host.go), run the lint
// engine alongside tsgo's typecheck diagnostics, and render through
// shim/diagnosticwriter so the output matches `tsgo --noEmit`.
//
// The split between this file and `engine.go` is deliberate: the engine
// is pure (rules + AST traversal), and this file owns every side effect
// (process flags, stderr/stdout, emit, exit codes).
package linthost

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
	shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
	shimtspath "github.com/microsoft/typescript-go/shim/tspath"

	publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// RunCheck implements `@ttsc/lint check`: typecheck + lint, no emit.
//
// @evidence contracts/common.md#principled-implementation Process streams delegate to the same no-emit check entry point used by injected-stream callers.
// @evidence contracts/common.md#clear-and-simple-design This wrapper owns only default stream selection.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Delegation preserves the supported command path without an alternate diagnostic implementation.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the check command and its no-emit effect; tags are separated from prose.
// @evidence contracts/portability.md#os-neutral-implementation RunCheck selects process-owned standard writers and preserves the native project-loading and optional emit boundary of RunCheckWithIO. The wrapper constructs no path or shell text; its delegated command owns actual cwd/config/source representations and filesystem capabilities.
// @evidence contracts/performance.md#efficient-algorithms Stream selection adds fixed wrapper work to the complete RunCheckWithIO operation. Total cost still includes its flags/config/Program/diagnostic and policy-permitted emit workload; delegation does not make the command constant-cost or omit temporary project storage.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This wrapper owns only stream defaults and delegates to RunCheckWithIO, whose shared Program and config/resident reuse premises remain unchanged. It is not an additional cross-request producer or result coordinator.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Standard streams belong to the process and are not closed by the wrapper. RunCheckWithIO and its shared project runner own acquired Program/checker state and delegated evaluator resources, while separate cache owners retain their state; this stream adapter controls no independent retained population.
func RunCheck(args []string) int {
	return RunCheckWithIO(args, os.Stdout, os.Stderr)
}

// RunCheckWithIO runs check with invocation-owned output streams.
// Writers must be nonnil. Returns 0 on success or 2 for configuration,
// compiler or lint errors; warnings do not fail the check.
// The private --check-observations-json option publishes this same Program's
// consumed compiler/config/contributor inputs before close, including on a
// diagnosed check. Unobserved or unsupported consumption withdraws authority;
// the result never substitutes a later filesystem read for consumed bytes.
//
// @evidence contracts/common.md#principled-implementation Shared flag parsing forces noEmit before project loading, so lint and compiler diagnostics use one loaded Program. Negotiated check observations project that Program's resident reference graph, compiler-returned text predicates, loader-consumed versioned fingerprints and contributor-consumed raw bytes; partial or conflicting evidence is carried as refusal rather than complete proof.
// @evidence contracts/common.md#clear-and-simple-design This entry selects check policy; the shared runner owns Program lifetime, its per-generation VFS/reader own consumed predicates, and the private publisher serializes before close. Typed config kinds remain distinct from compiler text and raw contributor hashes because their encodings and consumption owners differ.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported writer and contributor-reader boundaries leave process globals unchanged. Check observations use no second Program or late content hash; a contributor capability marker cannot replace actual consumption, and unsupported operations withdraw completeness.
// @evidence contracts/common.md#meaningful-documentation The entry comment states writer ownership, status/no-emit behavior and private observation lifetime. Helper comments explain lexical/physical coordinates, raw versus decoded bytes, sticky disagreement and unsupported evidence separately from these tags.
// @evidence contracts/portability.md#os-neutral-implementation cwd uses filepath.Abs or os.Getwd and the compiler VFS supplies its actual case policy. Contributor calls retain native bytes/errors; their absolute observation coordinates do not reinterpret relative paths as project-root-relative. Wire keys use relative slash spelling only within cwd; physical spelling remains a separate predicate. Unrepresentable link-entry evidence withdraws authority rather than borrowing target semantics or assuming capabilities from an OS name.
// @evidence contracts/performance.md#efficient-algorithms One Program supplies compiler and lint work. Recording adds hashing of actually consumed text/raw bytes, native identity checks and retained selected listings; publication traverses resident sources/references and observed/config paths, sorting wire lists and deduplicating kind/scope predicates. Cost includes source/config bytes, checker/engine work, observation populations/list sizes, path comparisons, output JSON and diagnostics; there is no unrelated proof-only traversal or unmeasured speed claim.
// @evidence contracts/performance.md#reuse-equivalent-work One invocation shares the actual Program, not a reconstructed observation Program. Loader/resident-rule reuse retains its existing consumed-dependency validation and per-kind fingerprints. Reader observations belong only to the loaded generation; an update invalidates its one-shot observer rather than merging unrelated generations. Publication supplies predicates to downstream current-state validation, not permission to reuse based merely on a key or marker.
// @evidence contracts/performance.md#bound-retention-and-release-resources Caller writers remain open. The runner closes its checker/Program after publication; per-generation records grow with actually consumed canonical/lexical addresses, byte witnesses and listing sizes, without an independent historical ledger. Contributor ReadFile closes its descriptor before return. The publisher owns one temporary file through write/close/rename and preserves non-missing cleanup errors. Existing config/resident caches retain state under their owners; this command introduces no global byte cap or cancellation deadline.
func RunCheckWithIO(args []string, stdout, stderr io.Writer) int {
	opts, err := parseSubcommandFlagsWithIO("check", args, stdout, stderr)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 2
	}
	opts.noEmit = true
	return runProject(opts)
}

// RunBuild implements `@ttsc/lint build`: same diagnostic flow as
// `check`, plus the tsgo emit pipeline when emit is requested.
//
// @evidence contracts/common.md#principled-implementation Default process writers delegate to the build entry point that preserves compiler emit configuration.
// @evidence contracts/common.md#clear-and-simple-design The wrapper adds only process stream selection to shared build behavior.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Emit uses the compiler pipeline rather than rewriting generated output for expected examples.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes build's emission from check's no-emit operation; tags are separated.
// @evidence contracts/portability.md#os-neutral-implementation RunBuild selects process-owned standard writers and preserves the native project-loading and optional emit boundary of RunBuildWithIO. The wrapper constructs no path or shell text; its delegated command owns actual cwd/config/source representations and filesystem capabilities.
// @evidence contracts/performance.md#efficient-algorithms Stream selection adds fixed wrapper work to the complete RunBuildWithIO operation. Total cost still includes its flags/config/Program/diagnostic and policy-permitted emit workload; delegation does not make the command constant-cost or omit temporary project storage.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This wrapper owns only stream defaults and delegates to RunBuildWithIO, whose shared Program and config/resident reuse premises remain unchanged. It is not an additional cross-request producer or result coordinator.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Standard streams belong to the process and are not closed by the wrapper. RunBuildWithIO and its shared project runner own acquired Program/checker state and delegated evaluator resources, while separate cache owners retain their state; this stream adapter controls no independent retained population.
func RunBuild(args []string) int {
	return RunBuildWithIO(args, os.Stdout, os.Stderr)
}

// RunBuildWithIO runs build with invocation-owned output streams.
// Writers must be nonnil. Returns 0 on success, 2 for configuration or
// diagnostics errors, or 3 when the compiler produces no emit result.
//
// @evidence contracts/common.md#principled-implementation Shared setup forwards compiler options and performs lint and compiler diagnostics before compiler-owned emission.
// @evidence contracts/common.md#clear-and-simple-design The project runner owns the common pipeline and this adapter owns command policy and streams.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Writer injection preserves invocation isolation through the documented boundary.
// @evidence contracts/common.md#meaningful-documentation Native prose states stream ownership and the adjacent build documentation states the emit distinction.
// @evidence contracts/portability.md#os-neutral-implementation RunBuildWithIO resolves cwd through filepath.Abs or os.Getwd, then loads native config/source paths through the shared project runner and compiler host. Emit, when command/config policy permits it, uses filepath parent directories and os writes; mode bits depend on the filesystem. Injected writers do not replace this native boundary or authorize path-case assumptions.
// @evidence contracts/performance.md#efficient-algorithms Flags and forwarded argument bytes are parsed once per invocation, config policy is loaded and one Program is built before shared compiler/lint diagnostics. Work includes config/dependency bytes, compiler-selected source/checker work, engine visits/findings, formatted diagnostics and optional emitted bytes. Shared setup avoids separate Programs for lint and typecheck; no constant complete-command cost or unmeasured speedup is claimed.
// @evidence contracts/performance.md#reuse-equivalent-work One invocation shares its Program across compiler and lint diagnostics and uses the config loader's recorded-dependency evaluation cache. The resident rule cache, when installed by its owner, establishes its own equivalence premises. This entry creates no additional cross-invocation Program/result cache; effectful diagnostics or emission are not replayed merely because flags match.
// @evidence contracts/performance.md#bound-retention-and-release-resources Command writers remain caller-owned. After successful Program acquisition, runProject defers close to drop the standalone lint checker; Program/config/findings/output become reclaimable when no longer referenced. Config evaluator caches and any installed resident-rule memo retain state under their separate owners. No command history cache, global input/output byte cap or caller cancellation deadline is introduced here.
func RunBuildWithIO(args []string, stdout, stderr io.Writer) int {
	opts, err := parseSubcommandFlagsWithIO("build", args, stdout, stderr)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 2
	}
	return runProject(opts)
}

// RunTransform implements `@ttsc/lint transform --file=PATH`. Lint rules
// still run for the whole program (lint quality depends on context), but
// emit is restricted to the requested file's JS output.
//
// @evidence contracts/common.md#principled-implementation The default-stream wrapper preserves project-wide diagnostics and target-only JavaScript emission in its delegated implementation.
// @evidence contracts/common.md#clear-and-simple-design This wrapper selects process output without duplicating transformation orchestration.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Transformation remains compiler-owned rather than a special source-text substitute.
// @evidence contracts/common.md#meaningful-documentation Native prose explains whole-program lint context and the target-only emit boundary.
// @evidence contracts/portability.md#os-neutral-implementation RunTransform passes process standard writers to RunTransformWithIO without constructing shell text or rewriting paths. Its delegated operation owns native project/target/output representation and filesystem capabilities; stream selection does not remove that boundary.
// @evidence contracts/performance.md#efficient-algorithms Fixed stream selection is added to RunTransformWithIO config/Program/diagnostic/target-emit work and output bytes. The complete command retains that input-dependent cost and temporary storage despite this wrapper's lack of a loop.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This adapter selects stream defaults, not a cross-request producer. Program/config/resident reuse and effectful output premises remain those of RunTransformWithIO and its owners.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Standard streams belong to the process and are not closed by this adapter. RunTransformWithIO owns acquired checker/command/captured-output state and delegates cache/evaluator lifetime to their owners; the stream wrapper controls no independent retained population.
func RunTransform(args []string) int {
	return RunTransformWithIO(args, os.Stdout, os.Stderr)
}

// RunTransformWithIO runs transform with invocation-owned output streams.
// Writers must be nonnil. Output goes to stdout unless --out selects a file;
// returns 2 for configuration or diagnostics errors and 3 for failed emission
// or file output writes. A successful transformation returns 0. Writes to
// the provided stdout do not propagate writer errors through the exit code.
//
// @evidence contracts/common.md#principled-implementation Parsed project context selects a normalized source file from the loaded program; compiler emission captures only JavaScript output for that target and surfaces missing output or write failures.
// @evidence contracts/common.md#clear-and-simple-design Flag parsing, diagnostics, target lookup and output capture form one explicit command pipeline.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported emit callbacks and stream injection replace neither compiler globals nor generated content.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies stream ownership while the transform declaration explains project context and output scope.
// @evidence contracts/portability.md#os-neutral-implementation The working directory and --file use the cwd resolver and shimtspath.ResolvePath, while semantic config uses the environment channel. Config/source loading retains the compiler host native boundary. The --out path is passed to filepath.Dir/os.MkdirAll/os.WriteFile: a relative output path follows the process cwd, not the --cwd override. Mode bits depend on the filesystem; paths are not inferred from URL spelling or OS-based case policy.
// @evidence contracts/performance.md#efficient-algorithms Flags and their bytes are parsed once; config policy and one Program supply project-wide compiler/lint diagnostics. Target lookup scans source files and path bytes, while Emit selects one target but retains compiler-chosen transform work and generated byte cost. The last JavaScript output is captured and optional file writes convert it to bytes. All config/dependency, Program, diagnostics and target/output dimensions contribute; no universal dominant stage or unmeasured speedup is claimed.
// @evidence contracts/performance.md#reuse-equivalent-work One invocation uses the same Program for compiler/lint diagnostics and target emission. Config evaluation and any installed resident rule memo retain their separate dependency/equivalence premises; this command adds no cross-invocation Program or emitted-output cache. Matching flags or target bytes alone do not justify replaying diagnostics or file writes.
// @evidence contracts/performance.md#bound-retention-and-release-resources After successful Program acquisition a deferred close drops the standalone lint checker; Program and ordinary command references become reclaimable after their owners release them. The capture retains the last JavaScript string until output and return, and a file write adds a temporary byte conversion. Writers remain caller-owned, config/resident caches retain their own state, and no Program/output-size cap or caller cancellation deadline is established here.
func RunTransformWithIO(args []string, stdout, stderr io.Writer) int {
	semanticConfigPath := os.Getenv(semanticConfigPathEnv)
	fs := flag.NewFlagSet("transform", flag.ContinueOnError)
	fs.SetOutput(stderr)
	file := fs.String("file", "", "absolute or cwd-relative path of the .ts file to transform")
	out := fs.String("out", "", "write output JS to PATH (default: stdout)")
	tsconfig := fs.String("tsconfig", "tsconfig.json", "tsconfig owning --file")
	cwd := fs.String("cwd", "", "override the working directory")
	pluginsJSON := fs.String("plugins-json", "", "ttsc plugin manifest JSON")
	projectContextJSON := fs.String("project-context-json", "", "ttsc project identity JSON")
	singleThreaded := fs.Bool("singleThreaded", false, "run TypeScript-Go single-threaded")
	checkers := fs.Int("checkers", 0, "type-checker pool size (0 = TypeScript-Go default)")
	tsgoArgsRaw := fs.String("tsgo-args", "", "JSON array of forwarded tsgo CLI flags")
	_ = fs.Bool("diagnostics", false, "print @ttsc/lint diagnostics timing")
	_ = fs.Bool("extendedDiagnostics", false, "print @ttsc/lint diagnostics timing")
	if err := fs.Parse(filterKnownFlags(args, LintFlagAllowList)); err != nil {
		return 2
	}
	if *file == "" {
		fmt.Fprintln(stderr, "@ttsc/lint transform: --file is required")
		return 2
	}
	tsgoArgs, err := decodeTsgoArgs(*tsgoArgsRaw)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 2
	}
	resolvedCwd, err := resolveCwd(*cwd)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 2
	}
	projectIdentity, err := decodeProjectIdentity(*projectContextJSON)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 2
	}
	rules, err := loadRules(*pluginsJSON, resolvedCwd, *tsconfig)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 2
	}
	engine := NewEngineWithResolver(rules)
	if err := engine.ConfigError(); err != nil {
		fmt.Fprintln(stderr, err)
		return 2
	}
	engine.SetSerial(*singleThreaded)
	engine.SetCurrentDirectory(resolvedCwd)

	prog, parseDiags, err := loadProgram(resolvedCwd, *tsconfig, loadProgramOptions{
		forceEmit:          true,
		semanticConfigPath: semanticConfigPath,
		needsRuleChecker:   engine.NeedsTypeChecker(),
		singleThreaded:     *singleThreaded,
		checkers:           *checkers,
		tsgoArgs:           tsgoArgs,
		projectIdentity:    projectIdentity,
	})
	if err != nil {
		fmt.Fprintf(stderr, "@ttsc/lint: %v\n", err)
		return 2
	}
	if len(parseDiags) > 0 {
		shimdw.FormatASTDiagnosticsWithColorAndContext(stderr, parseDiags, resolvedCwd)
		return 2
	}
	defer prog.close()

	astDiags, lintDiags, err := collectDiagnostics(prog, engine)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 2
	}
	warnUnknownRules(stderr, engine.UnknownRules())
	if errors := shimdw.FormatMixedDiagnostics(stderr, astDiags, lintDiags, resolvedCwd); errors > 0 {
		return 2
	}

	// tsgo normalizes SourceFile.FileName() through tspath, resolving "."/".."
	// segments as well as separators. findSourceFile's comparison only swaps
	// separators, so an absolute --file value carrying an unresolved "."/".."
	// round-trip (or, on a POSIX host, backslash separators) could name the
	// right file and still miss (samchon/ttsc#319 is this same gap in ttsc's
	// resident serve host).
	absFile := shimtspath.ResolvePath(resolvedCwd, *file)
	target := prog.findSourceFile(absFile)
	if target == nil {
		fmt.Fprintf(stderr, "@ttsc/lint transform: source file not in program: %s\n", absFile)
		return 2
	}

	var captured string
	capture := func(name, text string, _ *shimcompiler.WriteFileData) error {
		if !isJavaScriptOutput(name) {
			return nil
		}
		captured = text
		return nil
	}
	result := prog.tsProgram.Emit(context.Background(), shimcompiler.EmitOptions{
		TargetSourceFile: target,
		WriteFile:        shimcompiler.WriteFile(capture),
	})
	if result == nil {
		fmt.Fprintln(stderr, "@ttsc/lint transform: Emit returned nil")
		return 3
	}
	if len(result.Diagnostics) > 0 {
		shimdw.FormatASTDiagnosticsWithColorAndContext(stderr, result.Diagnostics, resolvedCwd)
	}
	if captured == "" {
		fmt.Fprintf(stderr, "@ttsc/lint transform: no output produced for %s\n", absFile)
		return 3
	}
	if *out == "" {
		fmt.Fprint(stdout, captured)
		return 0
	}
	if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil {
		fmt.Fprintf(stderr, "@ttsc/lint transform: mkdir: %v\n", err)
		return 3
	}
	if err := os.WriteFile(*out, []byte(captured), 0o644); err != nil {
		fmt.Fprintf(stderr, "@ttsc/lint transform: write: %v\n", err)
		return 3
	}
	return 0
}

type subcommandOpts struct {
	cwd                   string
	tsconfig              string
	pluginsJSON           string
	emit                  bool
	noEmit                bool
	quiet                 bool
	verbose               bool
	diagnostics           bool
	outDir                string
	semanticConfigPath    string
	singleThreaded        bool
	checkers              int
	tsgoArgs              []string
	projectIdentity       publicrule.ProjectIdentity
	checkObservationsJSON string
	stdout                io.Writer
	stderr                io.Writer
}

// parseSubcommandFlags parses the shared flag set used by the `check`,
// `build`, and `fix`/`format` subcommands. Unknown flags are silently
// stripped by `filterKnownFlags` before the standard FlagSet sees them.
func parseSubcommandFlags(name string, args []string) (*subcommandOpts, error) {
	return parseSubcommandFlagsWithIO(name, args, os.Stdout, os.Stderr)
}

func parseSubcommandFlagsWithIO(name string, args []string, stdout, stderr io.Writer) (*subcommandOpts, error) {
	semanticConfigPath := os.Getenv(semanticConfigPathEnv)
	if stdout == nil {
		stdout = io.Discard
	}
	if stderr == nil {
		stderr = io.Discard
	}
	fs := flag.NewFlagSet(name, flag.ContinueOnError)
	fs.SetOutput(stderr)
	cwd := fs.String("cwd", "", "")
	tsconfig := fs.String("tsconfig", "tsconfig.json", "")
	pluginsJSON := fs.String("plugins-json", "", "")
	projectContextJSON := fs.String("project-context-json", "", "")
	emit := fs.Bool("emit", false, "")
	noEmit := fs.Bool("noEmit", false, "")
	quiet := fs.Bool("quiet", false, "")
	verbose := fs.Bool("verbose", false, "")
	diagnostics := fs.Bool("diagnostics", false, "")
	extendedDiagnostics := fs.Bool("extendedDiagnostics", false, "")
	outDir := fs.String("outDir", "", "")
	singleThreaded := fs.Bool("singleThreaded", false, "")
	checkers := fs.Int("checkers", 0, "")
	tsgoArgsRaw := fs.String("tsgo-args", "", "")
	checkObservationsJSON := ""
	known := LintFlagAllowList
	if name == "check" {
		fs.StringVar(&checkObservationsJSON, "check-observations-json", "", "private absolute check input result path")
		known = make(map[string]bool, len(LintFlagAllowList)+1)
		for key, value := range LintFlagAllowList {
			known[key] = value
		}
		known["check-observations-json"] = true
	}
	if err := fs.Parse(filterKnownFlags(args, known)); err != nil {
		return nil, err
	}
	if checkObservationsJSON != "" && !filepath.IsAbs(checkObservationsJSON) {
		return nil, errors.New("@ttsc/lint: check observations path must be absolute")
	}
	if *emit && *noEmit {
		return nil, errors.New("@ttsc/lint: --emit and --noEmit are mutually exclusive")
	}
	tsgoArgs, err := decodeTsgoArgs(*tsgoArgsRaw)
	if err != nil {
		return nil, err
	}
	resolvedCwd, err := resolveCwd(*cwd)
	if err != nil {
		return nil, err
	}
	projectIdentity, err := decodeProjectIdentity(*projectContextJSON)
	if err != nil {
		return nil, err
	}
	return &subcommandOpts{
		cwd:                   resolvedCwd,
		tsconfig:              *tsconfig,
		pluginsJSON:           *pluginsJSON,
		emit:                  *emit,
		noEmit:                *noEmit,
		quiet:                 *quiet,
		verbose:               *verbose,
		diagnostics:           *diagnostics || *extendedDiagnostics,
		outDir:                *outDir,
		semanticConfigPath:    semanticConfigPath,
		singleThreaded:        *singleThreaded,
		checkers:              *checkers,
		tsgoArgs:              tsgoArgs,
		projectIdentity:       projectIdentity,
		checkObservationsJSON: checkObservationsJSON,
		stdout:                stdout,
		stderr:                stderr,
	}, nil
}

// tsgoArgsEnv mirrors `driver.TsgoArgsEnv`: the environment channel the ttsc
// launcher publishes forwarded tsgo argv on. The name is duplicated rather
// than imported because this host deliberately does not depend on the ttsc
// driver module (see host.go).
const tsgoArgsEnv = "TTSC_TSGO_ARGS"

// decodeTsgoArgs decodes the JSON-array value of the `--tsgo-args` flag — the
// tsgo CLI flags the `ttsc` launcher forwarded — into a string slice.
//
// When the flag is absent the value is read from `TTSC_TSGO_ARGS` instead. The
// launcher moved the payload to the environment because a `--tsgo-args` flag
// is fatal to any sidecar whose `flag.FlagSet` predates it (issue #1188); the
// flag stays accepted so an older launcher paired with this host still works.
// An absent flag and an absent variable yield a nil slice.
func decodeTsgoArgs(raw string) ([]string, error) {
	source := "--tsgo-args"
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv(tsgoArgsEnv))
		source = tsgoArgsEnv
	}
	if raw == "" {
		return nil, nil
	}
	var args []string
	if err := json.Unmarshal([]byte(raw), &args); err != nil {
		return nil, fmt.Errorf("@ttsc/lint: invalid %s: %w", source, err)
	}
	return args, nil
}

// runProject is the shared body of RunCheck and RunBuild. It loads the
// program, collects diagnostics, renders them, and optionally emits
// JavaScript output when the config allows it.
func runProject(opts *subcommandOpts) (code int) {
	var observedProgram *program
	defer func() {
		if opts.checkObservationsJSON != "" {
			if err := observedProgram.writeCheckObservations(opts.checkObservationsJSON); err != nil {
				fmt.Fprintln(opts.stderr, err)
				if code == 0 {
					code = 2
				}
			}
		}
		if observedProgram != nil {
			observedProgram.close()
		}
	}()
	rules, err := loadRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
	if err != nil {
		fmt.Fprintln(opts.stderr, err)
		return 2
	}
	engine := NewEngineWithResolver(rules)
	if err := engine.ConfigError(); err != nil {
		fmt.Fprintln(opts.stderr, err)
		return 2
	}
	engine.SetSerial(opts.singleThreaded)
	// The rules relate files to the directory the Program opens in, never to
	// the process's working directory, whose spelling `os.Getwd` takes from the
	// shell's `PWD`.
	engine.SetCurrentDirectory(opts.cwd)

	prog, parseDiags, err := loadProgram(opts.cwd, opts.tsconfig, loadProgramOptions{
		forceEmit:          opts.emit,
		observeInputs:      opts.checkObservationsJSON != "",
		forceNoEmit:        opts.noEmit,
		outDir:             opts.outDir,
		semanticConfigPath: opts.semanticConfigPath,
		needsRuleChecker:   engine.NeedsTypeChecker(),
		singleThreaded:     opts.singleThreaded,
		checkers:           opts.checkers,
		tsgoArgs:           opts.tsgoArgs,
		projectIdentity:    opts.projectIdentity,
	})
	if err != nil {
		fmt.Fprintf(opts.stderr, "@ttsc/lint: %v\n", err)
		return 2
	}
	if len(parseDiags) > 0 {
		shimdw.FormatASTDiagnosticsWithColorAndContext(opts.stderr, parseDiags, opts.cwd)
		return 2
	}
	observedProgram = prog
	if prog.inputReader != nil {
		if source, ok := rules.(interface {
			residentRuleConfigState() residentRuleConfigState
		}); ok {
			state := source.residentRuleConfigState()
			prog.configInputs = state.dependencies
			// A JSON resident path guard is not itself consumed-byte authority.
			// It is covered only by its separately retained actual file fingerprint.
			for _, file := range state.files {
				observed := false
				for _, input := range state.dependencies {
					if input.Kind == configDependencyFile && filepath.Clean(input.Path) == filepath.Clean(file) {
						observed = true
						break
					}
				}
				if !observed {
					prog.inputReader.Unavailable()
				}
			}
		}
	}

	astDiags, lintDiags, diagnosticsTiming, err := collectDiagnosticsTimed(prog, engine)
	if err != nil {
		fmt.Fprintln(opts.stderr, err)
		return 2
	}
	printLintDiagnosticsTiming(opts.stdout, opts.diagnostics, diagnosticsTiming)
	warnUnknownRules(opts.stderr, engine.UnknownRules())
	if errCount := shimdw.FormatMixedDiagnostics(opts.stderr, astDiags, lintDiags, opts.cwd); errCount > 0 {
		return 2
	}

	if opts.noEmit || prog.parsed.ParsedConfig.CompilerOptions.NoEmit.IsTrue() {
		return 0
	}

	result := prog.tsProgram.Emit(context.Background(), shimcompiler.EmitOptions{
		WriteFile: shimcompiler.WriteFile(func(fileName, text string, data *shimcompiler.WriteFileData) error {
			return defaultWriteFile(fileName, text)
		}),
	})
	if result == nil {
		fmt.Fprintln(opts.stderr, "@ttsc/lint: Emit returned nil")
		return 3
	}
	if len(result.Diagnostics) > 0 {
		errCount := shimdw.FormatMixedDiagnostics(opts.stderr, result.Diagnostics, nil, opts.cwd)
		if errCount > 0 {
			return 2
		}
	}
	if opts.verbose && result.EmittedFiles != nil {
		fmt.Fprintf(opts.stdout, "@ttsc/lint: emitted=%d files\n", len(result.EmittedFiles))
		for _, f := range result.EmittedFiles {
			fmt.Fprintln(opts.stdout, "  +", f)
		}
	}
	return 0
}

// residentRules is the resident daemon's memo of one project's loaded rule
// configuration, installed by RunLSPServe and nil in every one-shot process.
//
// Loading rules evaluates the project's `lint.config.ts`, which means standing
// up a JavaScript runtime — the dominant cost of a verb that builds no Program
// at all. A one-shot pays it once and exits; the daemon was paying it per
// request, which is per document edit for a consumer that asks again whenever a
// file it watches moves.
var residentRules *residentRuleCache

type residentRuleCache struct {
	mu       sync.Mutex
	key      string
	resolver RuleResolver
	configs  *residentRuleConfigSnapshot
	// loads counts the resolver loads this memo did not avoid.
	//
	// It exists because a reuse is otherwise unobservable: a RuleResolver holds
	// maps, so it is not a comparable type and two of them cannot be asked
	// whether they are the same one. Without a count, a memo that silently never
	// hit would satisfy every other property asked of it.
	loads int
}

// residentRuleConfigState is the resolver-owned description of every input a
// resident answer depends on. Files are native JSON configs; dependencies are
// the executable loader's full fingerprints, including cache-only package
// files that deliberately stay out of ConfigPaths and external watch lists.
type residentRuleConfigState struct {
	dependencies []configDependencyFingerprint
	files        []string
}

type residentRuleConfigSnapshot struct {
	dependencies []configDependencyFingerprint
	files        map[string][sha256.Size]byte
}

// acquireRules returns the loaded rule configuration, reusing the daemon's memo
// while the complete state it was loaded from is unchanged.
//
// Native JSON configs are validated against their files. Executable configs
// retain the loader's complete dependency fingerprints, including missing
// resolution candidates and cache-only package files. The latter must remain
// outside public project watch lists without becoming invisible to the resident
// memo: an imported package edit can change the resolved rules just as surely
// as an edit to lint.config.ts itself.
func acquireRules(pluginsJSON, cwd, tsconfigPath string) (RuleResolver, error) {
	cache := residentRules
	if cache == nil {
		return loadRules(pluginsJSON, cwd, tsconfigPath)
	}
	key := strings.Join([]string{pluginsJSON, cwd, tsconfigPath}, "\x00")
	cache.mu.Lock()
	defer cache.mu.Unlock()
	if cache.resolver != nil &&
		cache.key == key &&
		ruleConfigsUnchanged(cache.configs) {
		return cache.resolver, nil
	}
	cache.loads++
	// Noted before the load, because the load is what the recorded state has to
	// describe. Evaluating a configuration stands up a JavaScript runtime and
	// takes seconds, which is ample room for an author's next save to land, and
	// a state read afterwards would describe that save rather than the resolver
	// built from what came before it.
	started := time.Now()
	resolver, err := loadRules(pluginsJSON, cwd, tsconfigPath)
	if err != nil {
		// A failed load clears the memo rather than leaving the previous answer
		// reachable: the next request has to see the same failure, not a rule set
		// from before the edit that broke it.
		cache.resolver = nil
		cache.configs = nil
		return nil, err
	}
	cache.key = key
	cache.resolver = resolver
	cache.configs = hashRuleConfigs(resolver, started)
	return resolver, nil
}

// hashRuleConfigs records the complete state the resolver was built from. JSON
// configs contribute file digests. Executable configs contribute the loader's
// full dependency fingerprints, including missing resolution candidates,
// directories, and cache-only package files that are not public watch inputs.
// A resolver naming no state records nothing, and a memo with no proof is never
// reused.
//
// A native JSON file written after the load began is recorded as nothing at
// all. Which bytes the resolver was built from is unknowable once an edit lands
// inside the evaluation window, and recording the ones readable now is the one
// wrong answer that never corrects itself: the memo would agree with a file the
// resolver does not match, and every later request would pass the reuse test
// until some further edit happened to disagree. Executable configs carry the
// loader's own pre/post dependency proof instead. Declining costs one reload.
//
// After, and not "not before". A filesystem timestamp and the instant the load
// began are read from the same clock, whose tick is coarse on Windows, so the
// save an author made just before asking shares its tick with the load start
// far more often than not — and rejecting equality there rejects every
// recording the memo could ever make. The write that equality could also mean
// is one the load's own read, hundreds of milliseconds later behind a
// JavaScript runtime start, would have picked up regardless; the edit this
// guard is for lands well inside the evaluation and is well past the tick.
//
// Read first and stated second, in that order. A write landing between the two
// moves the modification time forward and is caught; stating it first would
// leave the window the check exists to close.
func hashRuleConfigs(resolver RuleResolver, started time.Time) *residentRuleConfigSnapshot {
	if configCacheDisabled() {
		return nil
	}
	source, ok := resolver.(interface {
		residentRuleConfigState() residentRuleConfigState
	})
	if !ok {
		return nil
	}
	state := source.residentRuleConfigState()
	if len(state.files) == 0 && len(state.dependencies) == 0 {
		return nil
	}
	if !configDependencyDigestsAreCurrent(state.dependencies) {
		return nil
	}
	configs := make(map[string][sha256.Size]byte, len(state.files))
	for _, location := range state.files {
		contents, err := os.ReadFile(location)
		if err != nil {
			return nil
		}
		info, err := os.Stat(location)
		if err != nil || info.ModTime().After(started) {
			return nil
		}
		configs[location] = sha256.Sum256(contents)
	}
	return &residentRuleConfigSnapshot{
		dependencies: state.dependencies,
		files:        configs,
	}
}

func ruleConfigsUnchanged(configs *residentRuleConfigSnapshot) bool {
	if configCacheDisabled() ||
		configs == nil ||
		(len(configs.files) == 0 && len(configs.dependencies) == 0) ||
		!configDependencyDigestsAreCurrent(configs.dependencies) {
		return false
	}
	for location, recorded := range configs.files {
		contents, err := os.ReadFile(location)
		if err != nil || sha256.Sum256(contents) != recorded {
			return false
		}
	}
	return true
}

// loadRules decodes `--plugins-json`, locates the `@ttsc/lint` entry, and
// returns its resolved RuleResolver. Returns an empty RuleConfig (no rules
// enabled) when the lint entry is absent from the plugin manifest.
func loadRules(pluginsJSON, cwd, tsconfigPath string) (RuleResolver, error) {
	entries, err := ParsePlugins(pluginsJSON)
	if err != nil {
		return nil, err
	}
	entry, err := FindLintEntry(entries)
	if err != nil {
		return nil, err
	}
	if entry == nil {
		return bindProjectRuleResolver(RuleConfig{})
	}
	resolver, err := LoadConfigResolver(entry, cwd, tsconfigPath)
	if err != nil {
		return nil, err
	}
	return bindProjectRuleResolver(resolver)
}

func decodeProjectIdentity(raw string) (publicrule.ProjectIdentity, error) {
	if strings.TrimSpace(raw) == "" {
		return publicrule.ProjectIdentity{}, nil
	}
	var identity publicrule.ProjectIdentity
	if err := json.Unmarshal([]byte(raw), &identity); err != nil {
		return publicrule.ProjectIdentity{}, fmt.Errorf("@ttsc/lint: invalid --project-context-json: %w", err)
	}
	return identity, nil
}

// warnUnknownRules writes one warning line per name in `unknown` to `w`.
// Called after engine construction so a config that names a rule the native
// engine does not implement surfaces a loud warning instead of silently
// linting nothing for that rule.
func warnUnknownRules(w io.Writer, unknown []string) {
	for _, name := range unknown {
		fmt.Fprintf(w, "@ttsc/lint: ignoring unknown rule %q\n", name)
	}
}

// filterKnownFlags strips flags from `args` that are not present in `known`.
// The `known` map value is true when the flag takes a separate value token
// (e.g. `--tsconfig tsconfig.json`) and false for boolean flags. Unknown
// flags are silently dropped along with their value token when present.
// This lets the host forward a superset of flags without confusing the
// standard library's FlagSet.
func filterKnownFlags(args []string, known map[string]bool) []string {
	out := make([]string, 0, len(args))
	for i := 0; i < len(args); i++ {
		arg := args[i]
		if !strings.HasPrefix(arg, "-") || arg == "-" {
			out = append(out, arg)
			continue
		}
		name := strings.TrimLeft(arg, "-")
		hasValue := strings.Contains(name, "=")
		if index := strings.Index(name, "="); index >= 0 {
			name = name[:index]
		}
		// Lower-cased to match the one normalization the schema uses when it
		// generates this allow-list (`normalizeFlagToken` in
		// packages/ttsc/src/flags/normalizeFlagToken.ts): TypeScript's option parser matches
		// names case-insensitively, so an exact-spelling lookup here would stop
		// recognising a flag the launcher already resolved.
		needsValue, ok := known[strings.ToLower(name)]
		if !ok {
			if !hasValue && i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
				i++
			}
			continue
		}
		out = append(out, arg)
		if needsValue && !hasValue && i+1 < len(args) {
			i++
			out = append(out, args[i])
		}
	}
	return out
}

// collectDiagnostics collects tsgo typecheck diagnostics and lint findings
// for the shared renderer. FormatMixedDiagnostics establishes one source
// order across those independent producer slices.
func collectDiagnostics(prog *program, engine *Engine) ([]*shimast.Diagnostic, []*shimdw.LintDiagnostic, error) {
	astDiags, lintDiags, _, err := collectDiagnosticsTimed(prog, engine)
	return astDiags, lintDiags, err
}

type lintDiagnosticsTiming struct {
	lint time.Duration
}

func collectDiagnosticsTimed(prog *program, engine *Engine) ([]*shimast.Diagnostic, []*shimdw.LintDiagnostic, lintDiagnosticsTiming, error) {
	timing := lintDiagnosticsTiming{}
	astDiags := prog.programDiagnostics()
	lintStarted := time.Now()
	findings := prog.runLintCycle(engine)
	timing.lint = time.Since(lintStarted)
	nativeDiags := make([]*shimdw.LintDiagnostic, 0, len(findings))
	for _, finding := range findings {
		category := shimdw.LintCategoryError
		if finding.Severity == SeverityWarn {
			category = shimdw.LintCategoryWarning
		}
		nativeDiags = append(nativeDiags, shimdw.NewLintDiagnostic(
			finding.File,
			finding.Pos,
			finding.End,
			ruleCode(finding.Rule),
			category,
			fmt.Sprintf("[%s] %s", finding.Rule, finding.Message),
		))
	}
	return astDiags, nativeDiags, timing, nil
}

func printLintDiagnosticsTiming(w io.Writer, enabled bool, timing lintDiagnosticsTiming) {
	if !enabled {
		return
	}
	fmt.Fprintf(w, "@ttsc/lint time: %s\n", formatTimingSeconds(timing.lint))
}

func formatTimingSeconds(duration time.Duration) string {
	return fmt.Sprintf("%.3fs", duration.Seconds())
}

// resolveCwd returns an absolute working directory. When `override` is
// non-empty it is made absolute; otherwise the process working directory
// is returned.
func resolveCwd(override string) (string, error) {
	if override != "" {
		abs, err := filepath.Abs(override)
		if err != nil {
			return "", fmt.Errorf("@ttsc/lint: --cwd: %w", err)
		}
		return abs, nil
	}
	wd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("@ttsc/lint: cwd: %w", err)
	}
	return wd, nil
}

// isJavaScriptOutput reports whether `name` has a JavaScript output
// extension (.js, .mjs, or .cjs). Used to filter the emit callback so
// that `RunTransform` captures only the JS output for the target file.
func isJavaScriptOutput(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".js", ".mjs", ".cjs":
		return true
	default:
		return false
	}
}

// defaultWriteFile creates all parent directories and writes `text` to
// `name` with mode 0644. Used as the WriteFile callback in `runProject`
// when the user requested emit.
func defaultWriteFile(name string, text string) error {
	if err := os.MkdirAll(filepath.Dir(name), 0o755); err != nil {
		return err
	}
	return os.WriteFile(name, []byte(text), 0o644)
}
