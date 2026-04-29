package paths

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	"github.com/microsoft/typescript-go/shim/bundled"
	shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
	shimcore "github.com/microsoft/typescript-go/shim/core"
	shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
	shimparser "github.com/microsoft/typescript-go/shim/parser"
	"github.com/microsoft/typescript-go/shim/tsoptions"
	shimtspath "github.com/microsoft/typescript-go/shim/tspath"
	"github.com/microsoft/typescript-go/shim/vfs/cachedvfs"
	"github.com/microsoft/typescript-go/shim/vfs/osvfs"
)

const modePaths = "ttsc-paths"

type pluginEntry struct {
	Config map[string]any `json:"config"`
	Mode   string         `json:"mode"`
	Name   string         `json:"name"`
}

type program struct {
	cwd       string
	parsed    *tsoptions.ParsedCommandLine
	tsProgram *shimcompiler.Program
}

type pathsResolver struct {
	basePath    string
	outDir      string
	patterns    []pathsPattern
	rootDir     string
	sourceFiles map[string]string
}

type pathsPattern struct {
	pattern string
	targets []string
}

type textEdit struct {
	start int
	end   int
	text  string
}

func RunOutput(args []string) int {
	fs := flag.NewFlagSet("output", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	file := fs.String("file", "", "emitted file to transform")
	out := fs.String("out", "", "write transformed text to this file instead of updating --file")
	cwd := fs.String("cwd", "", "project directory")
	outDir := fs.String("outDir", "", "emit directory override")
	pluginsJSON := fs.String("plugins-json", "", "ttsc plugin manifest JSON")
	_ = fs.String("rewrite-mode", modePaths, "native mode")
	tsconfig := fs.String("tsconfig", "tsconfig.json", "project tsconfig")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *file == "" {
		fmt.Fprintln(os.Stderr, "@ttsc/paths: output requires --file")
		return 2
	}
	if err := requireConfig(*pluginsJSON); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	resolvedCwd, err := resolveCwd(*cwd)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	prog, parseDiags, err := loadProgram(resolvedCwd, *tsconfig, *outDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/paths: %v\n", err)
		return 2
	}
	if len(parseDiags) > 0 {
		shimdw.FormatASTDiagnosticsWithColorAndContext(os.Stderr, parseDiags, resolvedCwd)
		return 2
	}
	text, err := os.ReadFile(*file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/paths: read %s: %v\n", *file, err)
		return 2
	}
	patched, err := Apply(prog, *file, string(text))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	target := *file
	if *out != "" {
		target = *out
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/paths: mkdir: %v\n", err)
		return 2
	}
	if err := os.WriteFile(target, []byte(patched), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/paths: write %s: %v\n", target, err)
		return 2
	}
	return 0
}

func Apply(prog *program, fileName string, text string) (string, error) {
	resolver := newPathsResolver(prog)
	return resolver.apply(fileName, text)
}

func loadProgram(cwd, tsconfigPath string, outDir string) (*program, []*shimast.Diagnostic, error) {
	if !filepath.IsAbs(cwd) {
		abs, err := filepath.Abs(cwd)
		if err != nil {
			return nil, nil, fmt.Errorf("cwd: %w", err)
		}
		cwd = abs
	}
	resolved := tsconfigPath
	if !filepath.IsAbs(resolved) {
		resolved = filepath.Join(cwd, resolved)
	}
	fs := bundled.WrapFS(cachedvfs.From(osvfs.FS()))
	host := shimcompiler.NewCompilerHost(cwd, fs, bundled.LibPath(), nil, nil)
	parsed, parseDiags := tsoptions.GetParsedCommandLineOfConfigFile(
		resolved,
		&shimcore.CompilerOptions{},
		nil,
		host,
		nil,
	)
	if parsed == nil {
		return nil, nil, fmt.Errorf("tsoptions: parsed command line was nil for %s", resolved)
	}
	if len(parseDiags) > 0 {
		return nil, parseDiags, nil
	}
	if len(parsed.Errors) > 0 {
		return nil, parsed.Errors, nil
	}
	if outDir != "" {
		overrideOutDir(cwd, parsed, outDir)
	}
	tsProgram := shimcompiler.NewProgram(shimcompiler.ProgramOptions{
		Config:                      parsed,
		SingleThreaded:              shimcore.TSTrue,
		Host:                        host,
		UseSourceOfProjectReference: true,
	})
	if tsProgram == nil {
		return nil, nil, errors.New("compiler.NewProgram returned nil")
	}
	return &program{cwd: cwd, parsed: parsed, tsProgram: tsProgram}, nil, nil
}

func (p *program) userSourceFiles() []*shimast.SourceFile {
	out := make([]*shimast.SourceFile, 0)
	for _, f := range p.tsProgram.SourceFiles() {
		if f == nil || f.IsDeclarationFile {
			continue
		}
		out = append(out, f)
	}
	return out
}

func newPathsResolver(prog *program) *pathsResolver {
	resolver := &pathsResolver{sourceFiles: map[string]string{}}
	if prog == nil || prog.parsed == nil || prog.parsed.ParsedConfig == nil || prog.parsed.ParsedConfig.CompilerOptions == nil {
		return resolver
	}
	options := prog.parsed.ParsedConfig.CompilerOptions
	resolver.basePath = options.GetPathsBasePath(prog.cwd)
	resolver.outDir = normalizeOptionalPath(options.OutDir, prog.cwd)
	resolver.rootDir = normalizeOptionalPath(options.RootDir, prog.cwd)
	files := prog.userSourceFiles()
	if resolver.rootDir == "" {
		resolver.rootDir = commonSourceDir(files)
	}
	for _, file := range files {
		if file == nil {
			continue
		}
		name := normalizePath(file.FileName())
		resolver.sourceFiles[name] = name
		resolver.sourceFiles[stripKnownSourceExtension(name)] = name
	}
	if options.Paths != nil {
		for pattern, targets := range options.Paths.Entries() {
			resolver.patterns = append(resolver.patterns, pathsPattern{
				pattern: pattern,
				targets: append([]string(nil), targets...),
			})
		}
	}
	sort.SliceStable(resolver.patterns, func(i, j int) bool {
		return pathsPatternRank(resolver.patterns[i].pattern) > pathsPatternRank(resolver.patterns[j].pattern)
	})
	return resolver
}

func (r *pathsResolver) apply(fileName string, text string) (string, error) {
	if r == nil || len(r.patterns) == 0 || !isPathsOutput(fileName) {
		return text, nil
	}
	file := parseModuleSpecifierFile(fileName, text)
	if file == nil {
		return text, nil
	}
	edits := make([]textEdit, 0)
	addEdit := func(lit *shimast.Node) {
		if lit == nil || lit.Kind != shimast.KindStringLiteral {
			return
		}
		specifier := lit.Text()
		rewritten, ok := r.rewriteSpecifier(fileName, specifier)
		if !ok || rewritten == specifier {
			return
		}
		start, end, quote, ok := stringLiteralRange(text, lit)
		if !ok {
			return
		}
		edits = append(edits, textEdit{
			start: start,
			end:   end,
			text:  quoteJSString(quote, rewritten),
		})
	}
	var walk func(*shimast.Node)
	walk = func(node *shimast.Node) {
		if node == nil {
			return
		}
		switch node.Kind {
		case shimast.KindImportDeclaration:
			addEdit(node.AsImportDeclaration().ModuleSpecifier)
		case shimast.KindExportDeclaration:
			addEdit(node.AsExportDeclaration().ModuleSpecifier)
		case shimast.KindImportEqualsDeclaration:
			ref := node.AsImportEqualsDeclaration().ModuleReference
			if ref != nil && ref.Kind == shimast.KindExternalModuleReference {
				addEdit(ref.AsExternalModuleReference().Expression)
			}
		case shimast.KindImportType:
			arg := node.AsImportTypeNode().Argument
			if arg != nil && arg.Kind == shimast.KindLiteralType {
				addEdit(arg.AsLiteralTypeNode().Literal)
			}
		case shimast.KindModuleDeclaration:
			addEdit(node.AsModuleDeclaration().Name())
		case shimast.KindCallExpression:
			call := node.AsCallExpression()
			if call != nil && (isRequireCall(call) || isDynamicImportCall(call)) && call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
				addEdit(call.Arguments.Nodes[0])
			}
		}
		node.ForEachChild(func(child *shimast.Node) bool {
			walk(child)
			return false
		})
	}
	for _, stmt := range file.Statements.Nodes {
		walk(stmt)
	}
	return applyTextEdits(text, edits), nil
}

func (r *pathsResolver) rewriteSpecifier(outputFile string, specifier string) (string, bool) {
	if isExternalModuleNameRelative(specifier) || strings.HasPrefix(specifier, "/") {
		return specifier, false
	}
	for _, pattern := range r.patterns {
		capture, ok := matchPathPattern(pattern.pattern, specifier)
		if !ok || len(pattern.targets) == 0 {
			continue
		}
		for _, targetPattern := range pattern.targets {
			target := strings.ReplaceAll(targetPattern, "*", capture)
			source, ok := r.resolveTargetSource(target)
			if !ok {
				continue
			}
			targetOutput := r.outputPathForSource(source)
			relative, err := filepath.Rel(filepath.Dir(normalizePath(outputFile)), targetOutput)
			if err != nil {
				return specifier, false
			}
			relative = filepath.ToSlash(relative)
			if relative == "." {
				relative = "./" + filepath.Base(targetOutput)
			}
			if !strings.HasPrefix(relative, ".") {
				relative = "./" + relative
			}
			return relative, true
		}
	}
	return specifier, false
}

func (r *pathsResolver) resolveTargetSource(target string) (string, bool) {
	base := r.basePath
	if base == "" {
		base = "."
	}
	raw := normalizePath(filepath.Join(base, target))
	candidates := []string{raw}
	if stripKnownSourceExtension(raw) == raw {
		for _, ext := range knownResolvableExtensions() {
			candidates = append(candidates, raw+ext)
		}
		for _, ext := range knownResolvableExtensions() {
			candidates = append(candidates, filepath.ToSlash(filepath.Join(raw, "index"+ext)))
		}
	}
	for _, candidate := range candidates {
		normalized := normalizePath(candidate)
		if source, ok := r.sourceFiles[normalized]; ok {
			return source, true
		}
		if source, ok := r.sourceFiles[stripKnownSourceExtension(normalized)]; ok {
			return source, true
		}
	}
	return "", false
}

func (r *pathsResolver) outputPathForSource(source string) string {
	outputExt := outputExtensionForSource(source)
	if r.outDir == "" {
		return changeExtension(source, outputExt)
	}
	if r.rootDir != "" {
		if rel, err := filepath.Rel(r.rootDir, source); err == nil && !strings.HasPrefix(rel, "..") && !filepath.IsAbs(rel) {
			return normalizePath(filepath.Join(r.outDir, changeExtension(rel, outputExt)))
		}
	}
	return normalizePath(filepath.Join(r.outDir, filepath.Base(changeExtension(source, outputExt))))
}

func requireConfig(pluginsJSON string) error {
	if strings.TrimSpace(pluginsJSON) == "" {
		return fmt.Errorf("@ttsc/paths: missing --plugins-json")
	}
	var entries []pluginEntry
	if err := json.Unmarshal([]byte(pluginsJSON), &entries); err != nil {
		return fmt.Errorf("@ttsc/paths: invalid --plugins-json: %w", err)
	}
	for _, entry := range entries {
		if entry.Mode == modePaths || entry.Name == "@ttsc/paths" {
			return nil
		}
	}
	return fmt.Errorf("@ttsc/paths: plugin entry not found")
}

func resolveCwd(override string) (string, error) {
	if override != "" {
		abs, err := filepath.Abs(override)
		if err != nil {
			return "", fmt.Errorf("@ttsc/paths: --cwd: %w", err)
		}
		return abs, nil
	}
	wd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("@ttsc/paths: cwd: %w", err)
	}
	return wd, nil
}

func overrideOutDir(cwd string, parsed *tsoptions.ParsedCommandLine, outDir string) {
	if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
		return
	}
	if filepath.IsAbs(outDir) {
		parsed.ParsedConfig.CompilerOptions.OutDir = filepath.ToSlash(outDir)
		return
	}
	parsed.ParsedConfig.CompilerOptions.OutDir = filepath.ToSlash(filepath.Join(cwd, outDir))
}

func parseModuleSpecifierFile(fileName string, text string) *shimast.SourceFile {
	normalized := normalizePath(fileName)
	if !filepath.IsAbs(normalized) {
		if abs, err := filepath.Abs(normalized); err == nil {
			normalized = normalizePath(abs)
		}
	}
	opts := shimast.SourceFileParseOptions{FileName: normalized}
	kind := shimcore.ScriptKindJS
	if isDeclarationOutput(fileName) {
		kind = shimcore.ScriptKindTS
	}
	return shimparser.ParseSourceFile(opts, text, kind)
}

func isRequireCall(call *shimast.CallExpression) bool {
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindIdentifier {
		return false
	}
	return call.Expression.Text() == "require"
}

func isDynamicImportCall(call *shimast.CallExpression) bool {
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindImportKeyword {
		return false
	}
	return call.Arguments != nil && len(call.Arguments.Nodes) == 1
}

func stringLiteralRange(text string, node *shimast.Node) (int, int, byte, bool) {
	start := clamp(node.Pos(), 0, len(text))
	end := clamp(node.End(), start, len(text))
	for start < end && text[start] != '"' && text[start] != '\'' {
		start++
	}
	if start >= end {
		return 0, 0, 0, false
	}
	quote := text[start]
	for end > start+1 && text[end-1] != quote {
		end--
	}
	if end <= start+1 {
		return 0, 0, 0, false
	}
	return start, end, quote, true
}

func quoteJSString(quote byte, value string) string {
	var b strings.Builder
	b.WriteByte(quote)
	for _, r := range value {
		switch r {
		case '\\':
			b.WriteString(`\\`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		default:
			if byte(r) == quote && r < utf8RuneSelf {
				b.WriteByte('\\')
				b.WriteByte(byte(r))
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte(quote)
	return b.String()
}

const utf8RuneSelf = 0x80

func applyTextEdits(text string, edits []textEdit) string {
	if len(edits) == 0 {
		return text
	}
	sort.SliceStable(edits, func(i, j int) bool {
		if edits[i].start == edits[j].start {
			return edits[i].end > edits[j].end
		}
		return edits[i].start > edits[j].start
	})
	out := text
	lastStart := len(text) + 1
	for _, edit := range edits {
		if edit.start < 0 || edit.end < edit.start || edit.start > len(out) {
			continue
		}
		if edit.end > lastStart {
			edit.end = lastStart
		}
		if edit.end > len(out) {
			edit.end = len(out)
		}
		out = out[:edit.start] + edit.text + out[edit.end:]
		lastStart = edit.start
	}
	return out
}

func matchPathPattern(pattern string, specifier string) (string, bool) {
	star := strings.Index(pattern, "*")
	if star < 0 {
		return "", pattern == specifier
	}
	prefix := pattern[:star]
	suffix := pattern[star+1:]
	if !strings.HasPrefix(specifier, prefix) || !strings.HasSuffix(specifier, suffix) {
		return "", false
	}
	return specifier[len(prefix) : len(specifier)-len(suffix)], true
}

func commonSourceDir(files []*shimast.SourceFile) string {
	var common string
	for _, file := range files {
		if file == nil {
			continue
		}
		dir := filepath.Dir(normalizePath(file.FileName()))
		if common == "" {
			common = dir
			continue
		}
		common = commonPathPrefix(common, dir)
	}
	return common
}

func commonPathPrefix(a string, b string) string {
	aParts := strings.Split(normalizePath(a), "/")
	bParts := strings.Split(normalizePath(b), "/")
	n := len(aParts)
	if len(bParts) < n {
		n = len(bParts)
	}
	i := 0
	for i < n && aParts[i] == bParts[i] {
		i++
	}
	if i == 0 {
		return ""
	}
	return strings.Join(aParts[:i], "/")
}

func normalizeOptionalPath(value string, cwd string) string {
	if value == "" {
		return ""
	}
	if filepath.IsAbs(value) {
		return normalizePath(value)
	}
	return normalizePath(filepath.Join(cwd, value))
}

func normalizePath(value string) string {
	return filepath.ToSlash(shimtspath.NormalizePath(value))
}

func stripKnownSourceExtension(value string) string {
	for _, ext := range []string{".d.ts", ".d.mts", ".d.cts", ".tsx", ".ts", ".mts", ".cts", ".jsx", ".js", ".json"} {
		if strings.HasSuffix(value, ext) {
			return strings.TrimSuffix(value, ext)
		}
	}
	return value
}

func outputExtensionForSource(source string) string {
	switch strings.ToLower(filepath.Ext(source)) {
	case ".mts":
		return ".mjs"
	case ".cts":
		return ".cjs"
	case ".json":
		return ".json"
	default:
		return ".js"
	}
}

func changeExtension(value string, ext string) string {
	return strings.TrimSuffix(value, filepath.Ext(value)) + ext
}

func isExternalModuleNameRelative(specifier string) bool {
	return strings.HasPrefix(specifier, "./") ||
		strings.HasPrefix(specifier, "../") ||
		specifier == "." ||
		specifier == ".."
}

func isPathsOutput(fileName string) bool {
	return isJavaScriptOutput(fileName) || isDeclarationOutput(fileName)
}

func isJavaScriptOutput(fileName string) bool {
	switch strings.ToLower(filepath.Ext(fileName)) {
	case ".js", ".mjs", ".cjs":
		return true
	default:
		return false
	}
}

func isDeclarationOutput(fileName string) bool {
	lower := strings.ToLower(fileName)
	return strings.HasSuffix(lower, ".d.ts") ||
		strings.HasSuffix(lower, ".d.mts") ||
		strings.HasSuffix(lower, ".d.cts")
}

func knownResolvableExtensions() []string {
	return []string{".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".json"}
}

func pathsPatternRank(pattern string) int {
	star := strings.Index(pattern, "*")
	if star < 0 {
		return 1_000_000 + len(pattern)
	}
	prefix := len(pattern[:star])
	suffix := len(pattern[star+1:])
	return prefix*1_000 + suffix*10 + len(pattern)
}

func clamp(value int, min int, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}
