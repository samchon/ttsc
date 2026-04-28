package lint

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimcore "github.com/microsoft/typescript-go/shim/core"
	shimparser "github.com/microsoft/typescript-go/shim/parser"
	shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

const (
	modeAlias  = "ttsc-alias"
	modeBanner = "ttsc-banner"
	modeLint   = "ttsc-lint"
	modeStrip  = "ttsc-strip"
)

type outputTransform interface {
	apply(fileName string, text string) (string, error)
}

type OutputPipeline struct {
	transforms []outputTransform
}

func LoadOutputPipeline(pluginsJSON string, prog *program) (*OutputPipeline, error) {
	entries, err := ParsePlugins(pluginsJSON)
	if err != nil {
		return nil, err
	}
	return NewOutputPipeline(entries, prog)
}

func NewOutputPipeline(entries []PluginEntry, prog *program) (*OutputPipeline, error) {
	pipeline := &OutputPipeline{}
	var alias *aliasResolver
	for _, entry := range entries {
		switch entry.Mode {
		case "", modeLint:
			continue
		case modeBanner:
			banner, err := parseBanner(entry.Config)
			if err != nil {
				return nil, err
			}
			pipeline.transforms = append(pipeline.transforms, banner)
		case modeAlias:
			if alias == nil {
				alias = newAliasResolver(prog)
			}
			pipeline.transforms = append(pipeline.transforms, alias)
		case modeStrip:
			strip, err := parseStrip(entry.Config)
			if err != nil {
				return nil, err
			}
			pipeline.transforms = append(pipeline.transforms, strip)
		default:
			return nil, fmt.Errorf("@ttsc/lint: unsupported first-party plugin mode %q", entry.Mode)
		}
	}
	return pipeline, nil
}

func (p *OutputPipeline) Apply(fileName string, text string) (string, error) {
	if p == nil {
		return text, nil
	}
	var err error
	for _, transform := range p.transforms {
		text, err = transform.apply(fileName, text)
		if err != nil {
			return "", err
		}
	}
	return text, nil
}

type bannerTransform struct {
	text string
}

func parseBanner(config map[string]any) (*bannerTransform, error) {
	raw, ok := config["banner"]
	if !ok {
		return nil, fmt.Errorf("@ttsc/banner: \"banner\" must be a non-empty string")
	}
	text, ok := raw.(string)
	if !ok || strings.TrimSpace(text) == "" {
		return nil, fmt.Errorf("@ttsc/banner: \"banner\" must be a non-empty string")
	}
	if !strings.HasSuffix(text, "\n") {
		text += "\n"
	}
	return &bannerTransform{text: text}, nil
}

func (b *bannerTransform) apply(fileName string, text string) (string, error) {
	if !isBannerableOutput(fileName) {
		return text, nil
	}
	if strings.HasPrefix(text, b.text) {
		return text, nil
	}
	return b.text + text, nil
}

type aliasResolver struct {
	basePath    string
	outDir      string
	patterns    []aliasPattern
	rootDir     string
	sourceFiles map[string]string
}

type aliasPattern struct {
	pattern string
	targets []string
}

func newAliasResolver(prog *program) *aliasResolver {
	resolver := &aliasResolver{sourceFiles: map[string]string{}}
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
			resolver.patterns = append(resolver.patterns, aliasPattern{
				pattern: pattern,
				targets: append([]string(nil), targets...),
			})
		}
	}
	sort.SliceStable(resolver.patterns, func(i, j int) bool {
		return aliasPatternRank(resolver.patterns[i].pattern) > aliasPatternRank(resolver.patterns[j].pattern)
	})
	return resolver
}

func (r *aliasResolver) apply(fileName string, text string) (string, error) {
	if r == nil || len(r.patterns) == 0 || !isAliasableOutput(fileName) {
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

func (r *aliasResolver) rewriteSpecifier(outputFile string, specifier string) (string, bool) {
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

func (r *aliasResolver) resolveTargetSource(target string) (string, bool) {
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

func (r *aliasResolver) outputPathForSource(source string) string {
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

type stripTransform struct {
	calls         []callPattern
	stripDebugger bool
}

type callPattern struct {
	parts    []string
	wildcard bool
}

func parseStrip(config map[string]any) (*stripTransform, error) {
	calls, err := stringArrayConfig(config, "calls")
	if err != nil {
		return nil, fmt.Errorf("@ttsc/strip: %w", err)
	}
	statements, err := stringArrayConfig(config, "statements")
	if err != nil {
		return nil, fmt.Errorf("@ttsc/strip: %w", err)
	}
	out := &stripTransform{}
	for _, call := range calls {
		pattern, err := parseCallPattern(call)
		if err != nil {
			return nil, fmt.Errorf("@ttsc/strip: %w", err)
		}
		out.calls = append(out.calls, pattern)
	}
	for _, statement := range statements {
		switch statement {
		case "debugger":
			out.stripDebugger = true
		default:
			return nil, fmt.Errorf("unsupported statement pattern %q", statement)
		}
	}
	return out, nil
}

func (s *stripTransform) apply(fileName string, text string) (string, error) {
	if s == nil || !isJavaScriptOutput(fileName) || (len(s.calls) == 0 && !s.stripDebugger) {
		return text, nil
	}
	file := parseJS(fileName, text)
	if file == nil {
		return text, nil
	}
	edits := make([]textEdit, 0)
	var walk func(*shimast.Node)
	walk = func(node *shimast.Node) {
		if node == nil {
			return
		}
		switch node.Kind {
		case shimast.KindDebuggerStatement:
			if s.stripDebugger {
				start, end := statementRemovalRange(text, node)
				edits = append(edits, textEdit{start: start, end: end})
			}
		case shimast.KindExpressionStatement:
			expr := node.AsExpressionStatement().Expression
			name, ok := callExpressionName(expr)
			if ok && s.matchesCall(name) {
				start, end := statementRemovalRange(text, node)
				edits = append(edits, textEdit{start: start, end: end})
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

func (s *stripTransform) matchesCall(name string) bool {
	for _, pattern := range s.calls {
		if pattern.matches(name) {
			return true
		}
	}
	return false
}

func parseCallPattern(text string) (callPattern, error) {
	parts := strings.Split(text, ".")
	if len(parts) == 0 {
		return callPattern{}, fmt.Errorf("empty call pattern")
	}
	for i, part := range parts {
		if part == "" {
			return callPattern{}, fmt.Errorf("invalid call pattern %q", text)
		}
		if part == "*" && i != len(parts)-1 {
			return callPattern{}, fmt.Errorf("wildcard is only supported at the end of call pattern %q", text)
		}
	}
	wildcard := parts[len(parts)-1] == "*"
	if wildcard {
		parts = parts[:len(parts)-1]
	}
	return callPattern{parts: parts, wildcard: wildcard}, nil
}

func (p callPattern) matches(name string) bool {
	parts := strings.Split(name, ".")
	if p.wildcard {
		if len(parts) <= len(p.parts) {
			return false
		}
		return equalStringSlices(parts[:len(p.parts)], p.parts)
	}
	return equalStringSlices(parts, p.parts)
}

func callExpressionName(expr *shimast.Node) (string, bool) {
	if expr == nil || expr.Kind != shimast.KindCallExpression {
		return "", false
	}
	call := expr.AsCallExpression()
	return dottedName(call.Expression)
}

func dottedName(expr *shimast.Node) (string, bool) {
	if expr == nil {
		return "", false
	}
	switch expr.Kind {
	case shimast.KindIdentifier:
		return expr.Text(), true
	case shimast.KindPropertyAccessExpression:
		prop := expr.AsPropertyAccessExpression()
		left, ok := dottedName(prop.Expression)
		if !ok || prop.Name() == nil {
			return "", false
		}
		return left + "." + prop.Name().Text(), true
	default:
		return "", false
	}
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

type textEdit struct {
	start int
	end   int
	text  string
}

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

func parseJS(fileName string, text string) *shimast.SourceFile {
	return parseModuleSpecifierFile(fileName, text)
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

func stringArrayConfig(config map[string]any, key string) ([]string, error) {
	raw, ok := config[key]
	if !ok || raw == nil {
		return nil, nil
	}
	values, ok := raw.([]any)
	if !ok {
		return nil, fmt.Errorf("%q must be an array of strings", key)
	}
	out := make([]string, 0, len(values))
	for i, value := range values {
		text, ok := value.(string)
		if !ok || strings.TrimSpace(text) == "" {
			return nil, fmt.Errorf("%q[%d] must be a non-empty string", key, i)
		}
		out = append(out, text)
	}
	return out, nil
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

func statementRemovalRange(text string, node *shimast.Node) (int, int) {
	start := clamp(node.Pos(), 0, len(text))
	end := clamp(node.End(), start, len(text))
	lineStart := start
	for lineStart > 0 && text[lineStart-1] != '\n' && text[lineStart-1] != '\r' {
		lineStart--
	}
	if strings.TrimSpace(text[lineStart:start]) == "" {
		start = lineStart
	}
	if end < len(text) && text[end] == ';' {
		end++
	}
	for end < len(text) && (text[end] == ' ' || text[end] == '\t') {
		end++
	}
	if end < len(text) && text[end] == '\r' {
		end++
	}
	if end < len(text) && text[end] == '\n' {
		end++
	}
	return start, end
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

func isBannerableOutput(fileName string) bool {
	lower := strings.ToLower(fileName)
	if strings.HasSuffix(lower, ".map") || strings.HasSuffix(lower, ".tsbuildinfo") {
		return false
	}
	return isJavaScriptOutput(fileName) ||
		isDeclarationOutput(fileName)
}

func isAliasableOutput(fileName string) bool {
	return isJavaScriptOutput(fileName) || isDeclarationOutput(fileName)
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

func aliasPatternRank(pattern string) int {
	star := strings.Index(pattern, "*")
	if star < 0 {
		return 1_000_000 + len(pattern)
	}
	prefix := len(pattern[:star])
	suffix := len(pattern[star+1:])
	return prefix*1_000 + suffix*10 + len(pattern)
}

func equalStringSlices(a []string, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
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
