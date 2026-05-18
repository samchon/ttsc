package utility

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
	shimprinter "github.com/microsoft/typescript-go/shim/printer"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

type hostOptions struct {
	cwd         string
	emit        bool
	noEmit      bool
	outDir      string
	pluginsJSON string
	quiet       bool
	tsconfig    string
	verbose     bool
}

type transformResult struct {
	Diagnostics []any             `json:"diagnostics,omitempty"`
	TypeScript  map[string]string `json:"typescript"`
}

// RunCheck validates the project and linked plugin configuration without
// emitting output.
func RunCheck(args []string) int {
	opts, ok := parseHostOptions("check", args)
	if !ok {
		return 2
	}
	opts.noEmit = true
	prog, _, ok := loadUtilityProgram(opts)
	if !ok {
		return 2
	}
	defer prog.Close()
	return 0
}

// RunBuild hosts linked transform packages inside one compiler emit.
func RunBuild(args []string) int {
	opts, ok := parseHostOptions("build", args)
	if !ok {
		return 2
	}
	prog, entries, ok := loadUtilityProgram(opts)
	if !ok {
		return 2
	}
	defer prog.Close()
	if opts.noEmit {
		return 0
	}
	if opts.verbose {
		opts.quiet = false
	}
	if !opts.quiet {
		fmt.Fprintf(os.Stdout, "// ttsc utility: plugins=%d emit=%v\n", len(entries), !opts.noEmit)
	}
	res, eDiags, err := prog.EmitAllRaw(makeSourcePreambleWriteFile(prog))
	if err != nil {
		fmt.Fprintf(os.Stderr, "ttsc utility: emit failed: %v\n", err)
		return 3
	}
	for _, d := range eDiags {
		fmt.Fprintln(os.Stderr, "  -", d.String())
	}
	if driver.CountErrors(eDiags) > 0 {
		return 2
	}
	if res != nil && !opts.quiet {
		fmt.Fprintf(os.Stdout, "// ttsc utility: emitted=%d files\n", len(res.EmittedFiles))
	}
	return 0
}

// RunTransform returns the project TypeScript text after linked source
// mutations.
func RunTransform(args []string) int {
	opts, ok := parseHostOptions("transform", args)
	if !ok {
		return 2
	}
	prog, _, ok := loadUtilityProgram(opts)
	if !ok {
		return 2
	}
	defer prog.Close()
	printer := shimprinter.NewPrinter(shimprinter.PrinterOptions{}, shimprinter.PrintHandlers{}, nil)
	out := transformResult{TypeScript: map[string]string{}}
	for _, file := range prog.SourceFiles() {
		text := shimprinter.EmitSourceFile(printer, file)
		if prog.SourcePreamble != "" && !shouldRemoveComments(prog) && !strings.Contains(text, prog.SourcePreamble) {
			text = driver.ApplySourcePreamble(text, prog.SourcePreamble)
		}
		out.TypeScript[apiOutputKey(opts.cwd, file.FileName())] = text
	}
	data, _ := json.Marshal(out)
	fmt.Fprintln(os.Stdout, string(data))
	return 0
}

func parseHostOptions(command string, args []string) (hostOptions, bool) {
	fs := flag.NewFlagSet(command, flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	cwd := fs.String("cwd", "", "project directory")
	emit := fs.Bool("emit", false, "force emit")
	noEmit := fs.Bool("noEmit", false, "force no emit")
	outDir := fs.String("outDir", "", "emit directory override")
	pluginsJSON := fs.String("plugins-json", "", "ttsc plugin manifest JSON")
	quiet := fs.Bool("quiet", true, "suppress summary")
	tsconfig := fs.String("tsconfig", "tsconfig.json", "project tsconfig")
	verbose := fs.Bool("verbose", false, "print summary")
	if err := fs.Parse(filterHostArgs(args)); err != nil {
		return hostOptions{}, false
	}
	if *emit && *noEmit {
		fmt.Fprintln(os.Stderr, "ttsc utility: --emit and --noEmit are mutually exclusive")
		return hostOptions{}, false
	}
	resolvedCwd := *cwd
	if resolvedCwd == "" {
		var err error
		resolvedCwd, err = os.Getwd()
		if err != nil {
			fmt.Fprintf(os.Stderr, "ttsc utility: cwd: %v\n", err)
			return hostOptions{}, false
		}
	}
	if !filepath.IsAbs(resolvedCwd) {
		abs, err := filepath.Abs(resolvedCwd)
		if err != nil {
			fmt.Fprintf(os.Stderr, "ttsc utility: cwd: %v\n", err)
			return hostOptions{}, false
		}
		resolvedCwd = abs
	}
	return hostOptions{
		cwd:         filepath.Clean(resolvedCwd),
		emit:        *emit,
		noEmit:      *noEmit,
		outDir:      *outDir,
		pluginsJSON: *pluginsJSON,
		quiet:       *quiet,
		tsconfig:    *tsconfig,
		verbose:     *verbose,
	}, true
}

func filterHostArgs(args []string) []string {
	known := map[string]bool{
		"cwd":          true,
		"emit":         false,
		"noEmit":       false,
		"outDir":       true,
		"plugins-json": true,
		"quiet":        false,
		"tsconfig":     true,
		"verbose":      false,
	}
	filtered := make([]string, 0, len(args))
	for i := 0; i < len(args); i++ {
		current := args[i]
		if current == "--" {
			break
		}
		if !strings.HasPrefix(current, "--") {
			filtered = append(filtered, current)
			continue
		}
		name, hasInlineValue := flagName(current)
		takesValue, ok := known[name]
		if ok {
			filtered = append(filtered, current)
			if takesValue && !hasInlineValue && i+1 < len(args) {
				i++
				filtered = append(filtered, args[i])
			}
			continue
		}
		if !hasInlineValue && i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
			i++
		}
	}
	return filtered
}

func flagName(arg string) (string, bool) {
	name := strings.TrimPrefix(arg, "--")
	before, _, found := strings.Cut(name, "=")
	return before, found
}

func loadUtilityProgram(opts hostOptions) (*driver.Program, []driver.PluginEntry, bool) {
	entries, err := parsePluginEntries(opts.pluginsJSON)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return nil, nil, false
	}
	restoreEnv := setLinkedPluginManifest(opts.pluginsJSON)
	defer restoreEnv()

	prog, diags, err := driver.LoadProgram(opts.cwd, opts.tsconfig, driver.LoadProgramOptions{
		ForceEmit:   opts.emit,
		ForceNoEmit: opts.noEmit,
		OutDir:      opts.outDir,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "ttsc utility: %v\n", err)
		return nil, nil, false
	}
	if len(diags) > 0 {
		driver.WritePrettyDiagnostics(os.Stderr, diags, opts.cwd)
		if prog != nil {
			_ = prog.Close()
		}
		return nil, nil, false
	}
	if diags := prog.Diagnostics(); len(diags) > 0 {
		driver.WritePrettyDiagnostics(os.Stderr, diags, opts.cwd)
		_ = prog.Close()
		return nil, nil, false
	}
	if err := prog.ApplyLinkedPlugins(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		_ = prog.Close()
		return nil, nil, false
	}
	return prog, entries, true
}

func parsePluginEntries(input string) ([]driver.PluginEntry, error) {
	if strings.TrimSpace(input) == "" {
		return nil, nil
	}
	var entries []driver.PluginEntry
	if err := json.Unmarshal([]byte(input), &entries); err != nil {
		return nil, fmt.Errorf("ttsc utility: invalid --plugins-json: %w", err)
	}
	return entries, nil
}

func setLinkedPluginManifest(input string) func() {
	previous, existed := os.LookupEnv(driver.LinkedPluginsEnv)
	if strings.TrimSpace(input) == "" {
		_ = os.Unsetenv(driver.LinkedPluginsEnv)
	} else {
		_ = os.Setenv(driver.LinkedPluginsEnv, input)
	}
	return func() {
		if existed {
			_ = os.Setenv(driver.LinkedPluginsEnv, previous)
		} else {
			_ = os.Unsetenv(driver.LinkedPluginsEnv)
		}
	}
}

func makeSourcePreambleWriteFile(prog *driver.Program) shimcompiler.WriteFile {
	if prog == nil || prog.SourcePreamble == "" || shouldRemoveComments(prog) {
		return nil
	}
	return func(fileName, text string, _ *shimcompiler.WriteFileData) error {
		if shouldEnsureSourcePreamble(fileName, text, prog.SourcePreamble) {
			text = driver.ApplySourcePreamble(text, prog.SourcePreamble)
		}
		return driver.DefaultWriteFile(fileName, text)
	}
}

func shouldRemoveComments(prog *driver.Program) bool {
	if prog == nil || prog.ParsedConfig == nil || prog.ParsedConfig.ParsedConfig == nil || prog.ParsedConfig.ParsedConfig.CompilerOptions == nil {
		return false
	}
	return prog.ParsedConfig.ParsedConfig.CompilerOptions.RemoveComments.IsTrue()
}

func shouldEnsureSourcePreamble(fileName, text, sourcePreamble string) bool {
	return isSourcePreambleOutputTarget(fileName) && !strings.Contains(text, sourcePreamble)
}

func isSourcePreambleOutputTarget(fileName string) bool {
	lower := strings.ToLower(filepath.ToSlash(fileName))
	for _, suffix := range []string{".d.ts", ".d.mts", ".d.cts", ".js", ".jsx", ".mjs", ".cjs"} {
		if strings.HasSuffix(lower, suffix) {
			return true
		}
	}
	return false
}

func apiOutputKey(cwd, fileName string) string {
	rel, err := filepath.Rel(cwd, fileName)
	if err != nil || isOutsideRelativePath(rel) {
		return filepath.ToSlash(fileName)
	}
	return filepath.ToSlash(rel)
}

func isOutsideRelativePath(rel string) bool {
	return rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
