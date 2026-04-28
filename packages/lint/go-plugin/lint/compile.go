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
package lint

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
	shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
)

// RunCheck implements `@ttsc/lint check` — typecheck + lint, no emit.
func RunCheck(args []string) int {
	opts, err := parseSubcommandFlags("check", args)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	opts.noEmit = true
	return runProject(opts)
}

// RunBuild implements `@ttsc/lint build` — same diagnostic flow as
// `check`, plus the tsgo emit pipeline when emit is requested.
func RunBuild(args []string) int {
	opts, err := parseSubcommandFlags("build", args)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	return runProject(opts)
}

// RunTransform implements `@ttsc/lint transform --file=PATH`. Lint rules
// still run for the whole program (lint quality depends on context), but
// emit is restricted to the requested file's JS output.
func RunTransform(args []string) int {
	fs := flag.NewFlagSet("transform", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	file := fs.String("file", "", "absolute or cwd-relative path of the .ts file to transform")
	out := fs.String("out", "", "write output JS to PATH (default: stdout)")
	tsconfig := fs.String("tsconfig", "tsconfig.json", "tsconfig owning --file")
	cwd := fs.String("cwd", "", "override the working directory")
	rewriteMode := fs.String("rewrite-mode", "ttsc-lint", "native rewrite backend id (informational)")
	pluginsJSON := fs.String("plugins-json", "", "ttsc plugin manifest JSON")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	_ = rewriteMode
	if *file == "" {
		fmt.Fprintln(os.Stderr, "@ttsc/lint transform: --file is required")
		return 2
	}
	resolvedCwd, err := resolveCwd(*cwd)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	prog, parseDiags, err := loadProgram(resolvedCwd, *tsconfig, false)
	if err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/lint: %v\n", err)
		return 2
	}
	if len(parseDiags) > 0 {
		shimdw.FormatASTDiagnosticsWithColorAndContext(os.Stderr, parseDiags, resolvedCwd)
		return 2
	}
	defer prog.close()

	rules, err := loadRules(*pluginsJSON)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	engine := NewEngine(rules)
	warnUnknownRules(os.Stderr, engine.UnknownRules())

	astDiags, lintDiags := collectDiagnostics(prog, engine)
	if errors := shimdw.FormatMixedDiagnostics(os.Stderr, astDiags, lintDiags, resolvedCwd); errors > 0 {
		return 2
	}

	absFile := *file
	if !filepath.IsAbs(absFile) {
		absFile = filepath.Join(resolvedCwd, absFile)
	}
	target := prog.findSourceFile(absFile)
	if target == nil {
		fmt.Fprintf(os.Stderr, "@ttsc/lint transform: source file not in program: %s\n", absFile)
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
		fmt.Fprintln(os.Stderr, "@ttsc/lint transform: Emit returned nil")
		return 3
	}
	if len(result.Diagnostics) > 0 {
		shimdw.FormatASTDiagnosticsWithColorAndContext(os.Stderr, result.Diagnostics, resolvedCwd)
	}
	if captured == "" {
		fmt.Fprintf(os.Stderr, "@ttsc/lint transform: no output produced for %s\n", absFile)
		return 3
	}
	if *out == "" {
		fmt.Fprint(os.Stdout, captured)
		return 0
	}
	if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/lint transform: mkdir: %v\n", err)
		return 3
	}
	if err := os.WriteFile(*out, []byte(captured), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/lint transform: write: %v\n", err)
		return 3
	}
	return 0
}

type subcommandOpts struct {
	cwd         string
	tsconfig    string
	pluginsJSON string
	rewriteMode string
	emit        bool
	noEmit      bool
	quiet       bool
	verbose     bool
	outDir      string
}

func parseSubcommandFlags(name string, args []string) (*subcommandOpts, error) {
	fs := flag.NewFlagSet(name, flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	cwd := fs.String("cwd", "", "")
	tsconfig := fs.String("tsconfig", "tsconfig.json", "")
	pluginsJSON := fs.String("plugins-json", "", "")
	rewriteMode := fs.String("rewrite-mode", "ttsc-lint", "")
	emit := fs.Bool("emit", false, "")
	noEmit := fs.Bool("noEmit", false, "")
	quiet := fs.Bool("quiet", false, "")
	verbose := fs.Bool("verbose", false, "")
	outDir := fs.String("outDir", "", "")
	if err := fs.Parse(args); err != nil {
		return nil, err
	}
	if *emit && *noEmit {
		return nil, errors.New("@ttsc/lint: --emit and --noEmit are mutually exclusive")
	}
	resolvedCwd, err := resolveCwd(*cwd)
	if err != nil {
		return nil, err
	}
	return &subcommandOpts{
		cwd:         resolvedCwd,
		tsconfig:    *tsconfig,
		pluginsJSON: *pluginsJSON,
		rewriteMode: *rewriteMode,
		emit:        *emit,
		noEmit:      *noEmit,
		quiet:       *quiet,
		verbose:     *verbose,
		outDir:      *outDir,
	}, nil
}

func runProject(opts *subcommandOpts) int {
	prog, parseDiags, err := loadProgram(opts.cwd, opts.tsconfig, opts.noEmit)
	if err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/lint: %v\n", err)
		return 2
	}
	if len(parseDiags) > 0 {
		shimdw.FormatASTDiagnosticsWithColorAndContext(os.Stderr, parseDiags, opts.cwd)
		return 2
	}
	defer prog.close()

	rules, err := loadRules(opts.pluginsJSON)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	engine := NewEngine(rules)
	warnUnknownRules(os.Stderr, engine.UnknownRules())

	astDiags, lintDiags := collectDiagnostics(prog, engine)
	if errCount := shimdw.FormatMixedDiagnostics(os.Stderr, astDiags, lintDiags, opts.cwd); errCount > 0 {
		return 2
	}

	if opts.noEmit || prog.parsed.ParsedConfig.CompilerOptions.NoEmit.IsTrue() {
		return 0
	}

	result := prog.tsProgram.Emit(context.Background(), shimcompiler.EmitOptions{})
	if result == nil {
		fmt.Fprintln(os.Stderr, "@ttsc/lint: Emit returned nil")
		return 3
	}
	if len(result.Diagnostics) > 0 {
		errCount := shimdw.FormatMixedDiagnostics(os.Stderr, result.Diagnostics, nil, opts.cwd)
		if errCount > 0 {
			return 2
		}
	}
	if opts.verbose && result.EmittedFiles != nil {
		fmt.Fprintf(os.Stdout, "@ttsc/lint: emitted=%d files\n", len(result.EmittedFiles))
		for _, f := range result.EmittedFiles {
			fmt.Fprintln(os.Stdout, "  +", f)
		}
	}
	return 0
}

func loadRules(pluginsJSON string) (RuleConfig, error) {
	entries, err := ParsePlugins(pluginsJSON)
	if err != nil {
		return nil, err
	}
	entry := FindLintEntry(entries)
	if entry == nil {
		return RuleConfig{}, nil
	}
	return ParseRules(entry.Config["rules"])
}

func warnUnknownRules(w io.Writer, unknown []string) {
	for _, name := range unknown {
		fmt.Fprintf(w, "@ttsc/lint: ignoring unknown rule %q\n", name)
	}
}

// collectDiagnostics merges tsgo typecheck diagnostics with the lint
// engine's findings. The renderer takes the two slices and walks them in
// source order, so we don't need to interleave here.
func collectDiagnostics(prog *program, engine *Engine) ([]*shimast.Diagnostic, []*shimdw.LintDiagnostic) {
	astDiags := prog.programDiagnostics()
	files := prog.userSourceFiles()
	findings := engine.Run(files, prog.checker)
	lintDiags := make([]*shimdw.LintDiagnostic, 0, len(findings))
	for _, finding := range findings {
		category := shimdw.LintCategoryError
		if finding.Severity == SeverityWarn {
			category = shimdw.LintCategoryWarning
		}
		lintDiags = append(lintDiags, shimdw.NewLintDiagnostic(
			finding.File,
			finding.Pos,
			finding.End,
			ruleCode(finding.Rule),
			category,
			fmt.Sprintf("[%s] %s", finding.Rule, finding.Message),
		))
	}
	return astDiags, lintDiags
}

// ruleCode hashes a rule name into a stable, positive int32 so the
// renderer's banner (`TS9123`-style) is unique per rule. Codes start at
// 9000 to avoid colliding with tsgo's diagnostic codes (which top out
// well below that range).
func ruleCode(name string) int32 {
	const prime = 16777619
	var h uint32 = 2166136261
	for i := 0; i < len(name); i++ {
		h ^= uint32(name[i])
		h *= prime
	}
	return int32(9000 + (h % 9000))
}

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

func isJavaScriptOutput(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".js", ".mjs", ".cjs":
		return true
	default:
		return false
	}
}
