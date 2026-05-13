// Package demo is a test-only `@ttsc/lint` contributor.
//
// Demonstrates the contributor protocol:
//   1. Build-time: `@ttsc/lint`'s JS factory finds this package via
//      tsconfig's `plugins: { demo: "lint-contributor-demo" }`, resolves
//      its `source` directory, and tells ttsc to merge it into the lint
//      binary as a sub-package.
//   2. Compile time: the host module copies these `.go` files into
//      `<scratch>/contrib/demo/` and synthesizes a blank import in the
//      main package, which triggers the `init()` below before `main`.
//   3. Runtime: `rule.Register(noTodoComment{})` populates the public
//      contributor registry. The host's adapter (`contrib_adapter.go`)
//      copies that registration into the engine's dispatch table, so a
//      user setting `"demo/no-todo-comment": "error"` in `lint.config.ts`
//      sees the same diagnostic stream as built-in rules emit.
//
// Notice that this file imports only `github.com/samchon/ttsc/packages/lint/rule`
// — no `shim/ast` dependency. The facade types (`rule.Kind`, `rule.Node`,
// `rule.File`, `rule.Context`) carry every accessor the rule needs, and
// `node.Inner()` is available as an escape hatch when a contributor
// genuinely needs a typed shim accessor.
package demo

import (
	"strings"

	"github.com/samchon/ttsc/packages/lint/rule"
)

func init() {
	rule.Register(noTodoComment{})
}

// noTodoComment flags `TODO` and `FIXME` markers inside line comments.
//
// Intentionally minimal: walks the source file once, scans the text for
// the literal markers, and reports each occurrence with a range pointing
// at the marker itself. Mirrors `@ttsc/lint`'s built-in `no-debugger`
// shape so the test case stays readable.
type noTodoComment struct{}

func (noTodoComment) Name() string { return "demo/no-todo-comment" }

func (noTodoComment) Visits() []rule.Kind {
	return []rule.Kind{rule.KindSourceFile}
}

func (noTodoComment) Check(ctx *rule.Context, _ *rule.Node) {
	if ctx == nil || ctx.File == nil {
		return
	}
	text := ctx.File.Text()
	scanCommentMarkers(text, "TODO", func(start, end int) {
		ctx.ReportRange(start, end, "TODO comment is not allowed.")
	})
	scanCommentMarkers(text, "FIXME", func(start, end int) {
		ctx.ReportRange(start, end, "FIXME comment is not allowed.")
	})
}

// scanCommentMarkers walks `text` and invokes `report` for every line
// comment that contains `marker`. The reported range covers just the
// marker token so the rendered diagnostic underline is short.
//
// Deliberately not a regex: the test fixture stays free of `regexp` import
// to mirror the small surface a real AST-only rule would touch, and so
// the contributor's compile-time dependency footprint stays trivial.
func scanCommentMarkers(text, marker string, report func(start, end int)) {
	for i := 0; i < len(text)-1; i++ {
		if text[i] != '/' || text[i+1] != '/' {
			continue
		}
		end := i + 2
		for end < len(text) && text[end] != '\n' {
			end++
		}
		line := text[i:end]
		offset := strings.Index(line, marker)
		if offset < 0 {
			i = end
			continue
		}
		start := i + offset
		report(start, start+len(marker))
		i = end
	}
}
