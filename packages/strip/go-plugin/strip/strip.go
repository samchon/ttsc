package strip

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimcore "github.com/microsoft/typescript-go/shim/core"
	shimparser "github.com/microsoft/typescript-go/shim/parser"
)

const modeStrip = "ttsc-strip"

type pluginEntry struct {
	Config map[string]any `json:"config"`
	Mode   string         `json:"mode"`
	Name   string         `json:"name"`
}

type stripTransform struct {
	calls         []callPattern
	stripDebugger bool
}

type callPattern struct {
	parts    []string
	wildcard bool
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
	_ = fs.String("cwd", "", "project directory")
	_ = fs.String("outDir", "", "emit directory override")
	pluginsJSON := fs.String("plugins-json", "", "ttsc plugin manifest JSON")
	_ = fs.String("rewrite-mode", modeStrip, "native mode")
	_ = fs.String("tsconfig", "tsconfig.json", "project tsconfig")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *file == "" {
		fmt.Fprintln(os.Stderr, "@ttsc/strip: output requires --file")
		return 2
	}
	config, err := findConfig(*pluginsJSON)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	text, err := os.ReadFile(*file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/strip: read %s: %v\n", *file, err)
		return 2
	}
	patched, err := Apply(*file, string(text), config)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	target := *file
	if *out != "" {
		target = *out
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/strip: mkdir: %v\n", err)
		return 2
	}
	if err := os.WriteFile(target, []byte(patched), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/strip: write %s: %v\n", target, err)
		return 2
	}
	return 0
}

func Apply(fileName string, text string, config map[string]any) (string, error) {
	strip, err := parseStrip(config)
	if err != nil {
		return "", err
	}
	return strip.apply(fileName, text)
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
			return nil, fmt.Errorf("@ttsc/strip: unsupported statement pattern %q", statement)
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

func parseJS(fileName string, text string) *shimast.SourceFile {
	normalized := filepath.ToSlash(fileName)
	if !filepath.IsAbs(normalized) {
		if abs, err := filepath.Abs(normalized); err == nil {
			normalized = filepath.ToSlash(abs)
		}
	}
	opts := shimast.SourceFileParseOptions{FileName: normalized}
	return shimparser.ParseSourceFile(opts, text, shimcore.ScriptKindJS)
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

func findConfig(pluginsJSON string) (map[string]any, error) {
	if strings.TrimSpace(pluginsJSON) == "" {
		return nil, fmt.Errorf("@ttsc/strip: missing --plugins-json")
	}
	var entries []pluginEntry
	if err := json.Unmarshal([]byte(pluginsJSON), &entries); err != nil {
		return nil, fmt.Errorf("@ttsc/strip: invalid --plugins-json: %w", err)
	}
	for _, entry := range entries {
		if entry.Mode == modeStrip || entry.Name == "@ttsc/strip" {
			if entry.Config == nil {
				return map[string]any{}, nil
			}
			return entry.Config, nil
		}
	}
	return nil, fmt.Errorf("@ttsc/strip: plugin entry not found")
}

func isJavaScriptOutput(fileName string) bool {
	switch strings.ToLower(filepath.Ext(fileName)) {
	case ".js", ".mjs", ".cjs":
		return true
	default:
		return false
	}
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
