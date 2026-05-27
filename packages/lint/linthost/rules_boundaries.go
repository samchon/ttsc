package linthost

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type boundariesElementTypes struct{}
type boundariesExternal struct{}
type boundariesEntryPoint struct{}
type boundariesNoPrivate struct{}
type boundariesNoUnknown struct{}

// boundariesDependencies is a v1 stub for the upstream unified
// `boundaries/dependencies` rule, which replaces the legacy
// `element-types` / `entry-point` / `external` / `no-private` /
// `no-unknown` rules with a single direction-aware policy block.
//
// The native engine accepts the same `elements` + `rules` config shape so
// projects can claim the rule id today, but the full direction
// validation is deferred. Until then this rule registers, decodes
// options without crashing, and emits no diagnostics.
type boundariesDependencies struct{}

func (boundariesElementTypes) Name() string { return "boundaries/element-types" }
func (boundariesExternal) Name() string     { return "boundaries/external" }
func (boundariesEntryPoint) Name() string   { return "boundaries/entry-point" }
func (boundariesNoPrivate) Name() string    { return "boundaries/no-private" }
func (boundariesNoUnknown) Name() string    { return "boundaries/no-unknown" }
func (boundariesDependencies) Name() string { return "boundaries/dependencies" }

func (boundariesElementTypes) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (boundariesExternal) Visits() []shimast.Kind     { return []shimast.Kind{shimast.KindSourceFile} }
func (boundariesEntryPoint) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindSourceFile} }
func (boundariesNoPrivate) Visits() []shimast.Kind    { return []shimast.Kind{shimast.KindSourceFile} }
func (boundariesNoUnknown) Visits() []shimast.Kind    { return []shimast.Kind{shimast.KindSourceFile} }
func (boundariesDependencies) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }

// Check is intentionally a no-op for the v1 stub. The rule accepts the
// upstream config shape via the shared `boundariesOptions` decoder so
// downstream configs type-check and load, then exits without reporting
// findings. Replace this body when the unified direction validation
// lands.
func (boundariesDependencies) Check(ctx *Context, node *shimast.Node) {
	_ = decodeBoundariesOptions(ctx)
}

func (boundariesElementTypes) Check(ctx *Context, node *shimast.Node) {
	opts := decodeBoundariesOptions(ctx)
	if len(opts.Elements) == 0 {
		return
	}
	source := classifyBoundaryFile(ctx.File.FileName(), opts.Elements)
	if source == nil {
		return
	}
	for _, dep := range collectBoundaryDependencies(node) {
		if !dep.relative {
			continue
		}
		targetPath, ok := resolveBoundaryImport(ctx.File.FileName(), dep.specifier)
		if !ok {
			continue
		}
		target := classifyBoundaryFile(targetPath, opts.Elements)
		if target == nil {
			continue
		}
		policy, rule := evaluateBoundaryPolicy(opts, source.Type, target.Type)
		if policy != "disallow" {
			continue
		}
		message := fmt.Sprintf("Import from boundary element %q is not allowed in %q.", target.Type, source.Type)
		if rule != nil && rule.Message != "" {
			message = rule.Message
		}
		reportBoundaryDependency(ctx, dep, message)
	}
}

func (boundariesExternal) Check(ctx *Context, node *shimast.Node) {
	opts := decodeBoundariesOptions(ctx)
	for _, dep := range collectBoundaryDependencies(node) {
		if dep.relative {
			continue
		}
		name := boundaryPackageName(dep.specifier)
		disallowed := matchAnyBoundaryPattern(opts.Disallow, dep.specifier, name)
		allowed := len(opts.Allow) == 0 || matchAnyBoundaryPattern(opts.Allow, dep.specifier, name)
		if !disallowed && allowed {
			continue
		}
		message := fmt.Sprintf("External dependency %q is not allowed.", dep.specifier)
		if opts.Message != "" {
			message = opts.Message
		}
		reportBoundaryDependency(ctx, dep, message)
	}
}

func (boundariesEntryPoint) Check(ctx *Context, node *shimast.Node) {
	opts := decodeBoundariesOptions(ctx)
	if len(opts.Elements) == 0 {
		return
	}
	source := classifyBoundaryFile(ctx.File.FileName(), opts.Elements)
	for _, dep := range collectBoundaryDependencies(node) {
		if !dep.relative {
			continue
		}
		targetPath, ok := resolveBoundaryImport(ctx.File.FileName(), dep.specifier)
		if !ok {
			continue
		}
		target := classifyBoundaryFile(targetPath, opts.Elements)
		if target == nil || len(target.Entry) == 0 {
			continue
		}
		if source != nil && source.RootPath == target.RootPath {
			continue
		}
		if matchBoundaryElementLocalPattern(target.Entry, target) {
			continue
		}
		reportBoundaryDependency(ctx, dep, fmt.Sprintf("Import %q through an allowed boundary entry point.", target.RelativePath))
	}
}

func (boundariesNoPrivate) Check(ctx *Context, node *shimast.Node) {
	opts := decodeBoundariesOptions(ctx)
	if len(opts.Elements) == 0 {
		return
	}
	source := classifyBoundaryFile(ctx.File.FileName(), opts.Elements)
	if source == nil {
		return
	}
	for _, dep := range collectBoundaryDependencies(node) {
		if !dep.relative {
			continue
		}
		targetPath, ok := resolveBoundaryImport(ctx.File.FileName(), dep.specifier)
		if !ok {
			continue
		}
		target := classifyBoundaryFile(targetPath, opts.Elements)
		if target == nil || len(target.Private) == 0 {
			continue
		}
		if source.RootPath == target.RootPath || !matchBoundaryElementLocalPattern(target.Private, target) {
			continue
		}
		reportBoundaryDependency(ctx, dep, fmt.Sprintf("Do not import private boundary file %q from another element.", target.RelativePath))
	}
}

func (boundariesNoUnknown) Check(ctx *Context, node *shimast.Node) {
	opts := decodeBoundariesOptions(ctx)
	if len(opts.Elements) == 0 {
		return
	}
	for _, dep := range collectBoundaryDependencies(node) {
		if !dep.relative {
			continue
		}
		targetPath, ok := resolveBoundaryImport(ctx.File.FileName(), dep.specifier)
		if !ok {
			continue
		}
		if classifyBoundaryFile(targetPath, opts.Elements) != nil {
			continue
		}
		reportBoundaryDependency(ctx, dep, fmt.Sprintf("Imported file %q does not match any configured boundary element.", boundaryDisplayPath(targetPath)))
	}
}

type boundaryStringList []string

func (l *boundaryStringList) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		*l = nil
		return nil
	}
	var single string
	if err := json.Unmarshal(data, &single); err == nil {
		*l = boundaryStringList{single}
		return nil
	}
	var many []string
	if err := json.Unmarshal(data, &many); err != nil {
		return err
	}
	*l = boundaryStringList(many)
	return nil
}

type boundariesOptions struct {
	Elements []boundaryElement    `json:"elements"`
	Rules    []boundaryPolicyRule `json:"rules"`
	Default  string               `json:"default"`
	Allow    boundaryStringList   `json:"allow"`
	Disallow boundaryStringList   `json:"disallow"`
	Message  string               `json:"message"`
}

type boundaryElement struct {
	Type    string             `json:"type"`
	Pattern string             `json:"pattern"`
	Entry   boundaryStringList `json:"entry"`
	Private boundaryStringList `json:"private"`
}

type boundaryPolicyRule struct {
	From     boundaryStringList `json:"from"`
	Allow    boundaryStringList `json:"allow"`
	Disallow boundaryStringList `json:"disallow"`
	Message  string             `json:"message"`
}

type boundaryFile struct {
	Element      boundaryElement
	Type         string
	Path         string
	RelativePath string
	RootPath     string
	LocalPath    string
	Entry        boundaryStringList
	Private      boundaryStringList
}

type boundaryDependency struct {
	node      *shimast.Node
	specifier string
	relative  bool
}

func decodeBoundariesOptions(ctx *Context) boundariesOptions {
	var opts boundariesOptions
	if ctx != nil {
		_ = ctx.DecodeOptions(&opts)
	}
	return opts
}

func collectBoundaryDependencies(node *shimast.Node) []boundaryDependency {
	out := []boundaryDependency{}
	var walk func(*shimast.Node)
	walk = func(n *shimast.Node) {
		if n == nil {
			return
		}
		switch n.Kind {
		case shimast.KindImportDeclaration:
			if imp := n.AsImportDeclaration(); imp != nil && imp.ModuleSpecifier != nil {
				specifier := stringLiteralText(imp.ModuleSpecifier)
				if specifier != "" {
					out = append(out, boundaryDependency{
						node:      imp.ModuleSpecifier,
						specifier: specifier,
						relative:  isRelativeBoundarySpecifier(specifier),
					})
				}
			}
		case shimast.KindExportDeclaration:
			if exp := n.AsExportDeclaration(); exp != nil && exp.ModuleSpecifier != nil {
				specifier := stringLiteralText(exp.ModuleSpecifier)
				if specifier != "" {
					out = append(out, boundaryDependency{
						node:      exp.ModuleSpecifier,
						specifier: specifier,
						relative:  isRelativeBoundarySpecifier(specifier),
					})
				}
			}
		}
		n.ForEachChild(func(child *shimast.Node) bool {
			walk(child)
			return false
		})
	}
	walk(node)
	return out
}

func classifyBoundaryFile(fileName string, elements []boundaryElement) *boundaryFile {
	normalized := normalizeBoundaryPath(fileName)
	matches := []boundaryFile{}
	for _, elem := range elements {
		if elem.Type == "" || elem.Pattern == "" {
			continue
		}
		rel, ok := boundaryRelativeMatch(elem.Pattern, normalized)
		if !ok {
			continue
		}
		root := boundaryElementRoot(elem.Pattern, rel)
		local := rel
		if root != "" {
			local = strings.TrimPrefix(rel, root)
			local = strings.TrimPrefix(local, "/")
		}
		matches = append(matches, boundaryFile{
			Element:      elem,
			Type:         elem.Type,
			Path:         normalized,
			RelativePath: rel,
			RootPath:     root,
			LocalPath:    local,
			Entry:        elem.Entry,
			Private:      elem.Private,
		})
	}
	if len(matches) == 0 {
		return nil
	}
	sort.Slice(matches, func(i, j int) bool {
		return len(matches[i].RootPath) > len(matches[j].RootPath)
	})
	return &matches[0]
}

func evaluateBoundaryPolicy(opts boundariesOptions, fromType, targetType string) (string, *boundaryPolicyRule) {
	defaultPolicy := opts.Default
	if defaultPolicy == "" {
		defaultPolicy = "allow"
	}
	for i := range opts.Rules {
		rule := &opts.Rules[i]
		if len(rule.From) > 0 && !matchAnyBoundaryPattern(rule.From, fromType) {
			continue
		}
		if len(rule.Disallow) > 0 && matchAnyBoundaryPattern(rule.Disallow, targetType) {
			return "disallow", rule
		}
		if len(rule.Allow) > 0 {
			if matchAnyBoundaryPattern(rule.Allow, targetType) {
				return "allow", rule
			}
			return "disallow", rule
		}
	}
	return defaultPolicy, nil
}

func resolveBoundaryImport(sourceFileName, specifier string) (string, bool) {
	if !isRelativeBoundarySpecifier(specifier) {
		return "", false
	}
	base := filepath.Dir(sourceFileName)
	target := filepath.Clean(filepath.Join(base, filepath.FromSlash(specifier)))
	candidates := []string{target}
	if filepath.Ext(target) == "" {
		for _, ext := range []string{".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"} {
			candidates = append(candidates, target+ext)
		}
		for _, ext := range []string{".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"} {
			candidates = append(candidates, filepath.Join(target, "index"+ext))
		}
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			abs, err := filepath.Abs(candidate)
			if err == nil {
				return abs, true
			}
			return candidate, true
		}
	}
	return "", false
}

func reportBoundaryDependency(ctx *Context, dep boundaryDependency, message string) {
	if dep.node != nil {
		ctx.Report(dep.node, message)
		return
	}
	ctx.ReportRange(0, 1, message)
}

func matchBoundaryElementLocalPattern(patterns boundaryStringList, file *boundaryFile) bool {
	if file == nil {
		return false
	}
	for _, pattern := range patterns {
		if boundaryPatternMatch(pattern, file.LocalPath) || boundaryPatternMatch(pattern, filepath.Base(file.LocalPath)) || boundaryPatternMatch(pattern, file.RelativePath) {
			return true
		}
	}
	return false
}

func matchAnyBoundaryPattern(patterns boundaryStringList, candidates ...string) bool {
	for _, pattern := range patterns {
		for _, candidate := range candidates {
			if boundaryPatternMatch(pattern, candidate) {
				return true
			}
		}
	}
	return false
}

func boundaryRelativeMatch(pattern, fileName string) (string, bool) {
	for _, candidate := range boundaryPathCandidates(fileName) {
		if boundaryPatternMatch(pattern, candidate) {
			return candidate, true
		}
	}
	return "", false
}

func boundaryPatternMatch(pattern, candidate string) bool {
	pattern = strings.TrimPrefix(normalizeBoundaryPath(pattern), "./")
	candidate = strings.TrimPrefix(normalizeBoundaryPath(candidate), "./")
	if pattern == "" || candidate == "" {
		return false
	}
	re, err := regexp.Compile("^" + regexp.QuoteMeta(pattern) + "$")
	if err != nil {
		return false
	}
	expr := re.String()
	expr = strings.ReplaceAll(expr, `\*\*`, ".*")
	expr = strings.ReplaceAll(expr, `\*`, `[^/]*`)
	expr = strings.ReplaceAll(expr, `\?`, `[^/]`)
	re, err = regexp.Compile(expr)
	if err != nil {
		return false
	}
	return re.MatchString(candidate)
}

func boundaryPathCandidates(path string) []string {
	normalized := strings.TrimPrefix(normalizeBoundaryPath(path), "/")
	candidates := []string{normalized}
	if cwd, err := os.Getwd(); err == nil {
		if rel, err := filepath.Rel(cwd, path); err == nil && !strings.HasPrefix(rel, "..") {
			candidates = append(candidates, normalizeBoundaryPath(rel))
		}
	}
	parts := strings.Split(normalized, "/")
	for i := 1; i < len(parts); i++ {
		candidates = append(candidates, strings.Join(parts[i:], "/"))
	}
	return uniqueBoundaryStrings(candidates)
}

func boundaryElementRoot(pattern, matched string) string {
	pattern = strings.TrimPrefix(normalizeBoundaryPath(pattern), "./")
	wildcard := len(pattern)
	for _, token := range []string{"*", "?"} {
		if idx := strings.Index(pattern, token); idx >= 0 && idx < wildcard {
			wildcard = idx
		}
	}
	root := strings.TrimSuffix(pattern[:wildcard], "/")
	if root == pattern {
		root = filepath.ToSlash(filepath.Dir(root))
		if root == "." {
			root = ""
		}
	}
	if root != "" {
		return root
	}
	if slash := strings.LastIndex(matched, "/"); slash >= 0 {
		return matched[:slash]
	}
	return ""
}

func boundaryPackageName(specifier string) string {
	if strings.HasPrefix(specifier, "@") {
		parts := strings.Split(specifier, "/")
		if len(parts) >= 2 {
			return parts[0] + "/" + parts[1]
		}
		return specifier
	}
	if idx := strings.Index(specifier, "/"); idx >= 0 {
		return specifier[:idx]
	}
	return specifier
}

func boundaryDisplayPath(path string) string {
	candidates := boundaryPathCandidates(path)
	if len(candidates) == 0 {
		return normalizeBoundaryPath(path)
	}
	return candidates[0]
}

func normalizeBoundaryPath(path string) string {
	return filepath.ToSlash(filepath.Clean(path))
}

func isRelativeBoundarySpecifier(specifier string) bool {
	return specifier == "." || specifier == ".." || strings.HasPrefix(specifier, "./") || strings.HasPrefix(specifier, "../")
}

func uniqueBoundaryStrings(values []string) []string {
	seen := map[string]struct{}{}
	out := []string{}
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func init() {
	Register(boundariesElementTypes{})
	Register(boundariesExternal{})
	Register(boundariesEntryPoint{})
	Register(boundariesNoPrivate{})
	Register(boundariesNoUnknown{})
	Register(boundariesDependencies{})
}
