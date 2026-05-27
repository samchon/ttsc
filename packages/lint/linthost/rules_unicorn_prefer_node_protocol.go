// unicorn/prefer-node-protocol: the bare Node built-in specifier
// (`import "fs"` / `require("fs")`) is ambiguous — a userland package
// named `fs` on the module path resolves first, silently hijacking
// what readers assume is the Node built-in. The `node:` prefix removes
// the ambiguity and is supported by every modern Node release.
//
// AST-only: visit `ImportDeclaration` for the static-import case and
// `CallExpression` for the `require(...)` case. Both reduce to a
// single string-literal specifier compared against the allowlist of
// Node built-in module names; matching specifiers (without the
// `node:` prefix) fire on the literal node itself so the diagnostic
// underlines the specifier text the reader needs to change.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-node-protocol.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// unicornPreferNodeProtocolBuiltins enumerates the bare Node built-in
// module specifiers that must be rewritten to use the `node:` prefix.
var unicornPreferNodeProtocolBuiltins = map[string]struct{}{
	"assert":              {},
	"assert/strict":       {},
	"async_hooks":         {},
	"buffer":              {},
	"child_process":       {},
	"cluster":             {},
	"console":             {},
	"constants":           {},
	"crypto":              {},
	"dgram":               {},
	"diagnostics_channel": {},
	"dns":                 {},
	"dns/promises":        {},
	"domain":              {},
	"events":              {},
	"fs":                  {},
	"fs/promises":         {},
	"http":                {},
	"http2":               {},
	"https":               {},
	"inspector":           {},
	"module":              {},
	"net":                 {},
	"os":                  {},
	"path":                {},
	"path/posix":          {},
	"path/win32":          {},
	"perf_hooks":          {},
	"process":             {},
	"punycode":            {},
	"querystring":         {},
	"readline":            {},
	"readline/promises":   {},
	"repl":                {},
	"stream":              {},
	"stream/consumers":    {},
	"stream/promises":     {},
	"stream/web":          {},
	"string_decoder":      {},
	"sys":                 {},
	"timers":              {},
	"timers/promises":     {},
	"tls":                 {},
	"trace_events":        {},
	"tty":                 {},
	"url":                 {},
	"util":                {},
	"util/types":          {},
	"v8":                  {},
	"vm":                  {},
	"wasi":                {},
	"worker_threads":      {},
	"zlib":                {},
}

type unicornPreferNodeProtocol struct{}

func (unicornPreferNodeProtocol) Name() string { return "unicorn/prefer-node-protocol" }
func (unicornPreferNodeProtocol) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindImportDeclaration, shimast.KindCallExpression}
}
func (unicornPreferNodeProtocol) Check(ctx *Context, node *shimast.Node) {
	switch node.Kind {
	case shimast.KindImportDeclaration:
		imp := node.AsImportDeclaration()
		if imp == nil || imp.ModuleSpecifier == nil {
			return
		}
		if imp.ModuleSpecifier.Kind != shimast.KindStringLiteral {
			return
		}
		specifier := stringLiteralText(imp.ModuleSpecifier)
		if _, ok := unicornPreferNodeProtocolBuiltins[specifier]; !ok {
			return
		}
		ctx.Report(imp.ModuleSpecifier, "Prefer `node:` protocol when importing Node built-ins.")
	case shimast.KindCallExpression:
		call := node.AsCallExpression()
		if call == nil || call.Expression == nil {
			return
		}
		if identifierText(call.Expression) != "require" {
			return
		}
		if call.Arguments == nil || len(call.Arguments.Nodes) != 1 {
			return
		}
		arg := call.Arguments.Nodes[0]
		if arg == nil || arg.Kind != shimast.KindStringLiteral {
			return
		}
		specifier := stringLiteralText(arg)
		if _, ok := unicornPreferNodeProtocolBuiltins[specifier]; !ok {
			return
		}
		ctx.Report(arg, "Prefer `node:` protocol when importing Node built-ins.")
	}
}

func init() {
	Register(unicornPreferNodeProtocol{})
}
