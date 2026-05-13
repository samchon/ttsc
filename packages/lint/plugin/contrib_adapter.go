// Adapter that bridges public `rule.Rule` contributors onto the engine's
// internal `Rule` interface. Built-in rules live in `package main` and
// dispatch directly through `Register`; contributors live in sibling
// packages and call `rule.Register` from their `init()`. This file walks
// the populated `rule.Registered()` slice and wraps each entry so the
// engine sees the same surface for built-in and contributor rules.
//
// Init order: every contributor package's `init` runs before `package
// main`'s init (Go spec). But the built-in rules also register from
// `package main` init functions and the relative order across files in
// the same package is alphabetical — so we cannot blindly run the
// contributor wiring from a file-level `init()` and expect built-in
// registration to have already completed. Instead, `registerContributors`
// is invoked explicitly from `main.run` after all built-in `init` calls
// have settled, which makes the collision check meaningful.
//
// Type bridging: contributor rules speak the public `rule.Kind` /
// `rule.Node` / `rule.File` types. The engine internally uses
// `shimast.Kind` / `*shimast.Node` / `*shimast.SourceFile`. The adapter
// wraps shim nodes when invoking `Check` and unwraps them when the
// rule's report callback fires.
package main

import (
	"fmt"
	"os"
	"sort"

	shimast "github.com/microsoft/typescript-go/shim/ast"

	"github.com/samchon/ttsc/packages/lint/rule"
)

// registerContributors wraps every contributor rule registered through
// the public `rule` package into the engine's internal `Rule` interface
// and pushes it onto the same dispatch table the built-in rules use.
//
// Collision policy: a contributor that shares a name with an existing
// rule (built-in or another contributor whose init ran first) is dropped
// with a stderr warning. The host prefers a deterministic, debuggable
// outcome over panicking inside startup.
func registerContributors() {
	contributors := rule.Registered()
	sort.SliceStable(contributors, func(i, j int) bool {
		return contributors[i].Name() < contributors[j].Name()
	})
	for _, contributor := range contributors {
		name := contributor.Name()
		if name == "" {
			fmt.Fprintln(os.Stderr, "@ttsc/lint: contributor rule with empty name ignored")
			continue
		}
		if LookupRule(name) != nil {
			fmt.Fprintf(os.Stderr,
				"@ttsc/lint: contributor rule %q collides with an existing rule; dropping contributor entry\n",
				name)
			continue
		}
		Register(contributorAdapter{inner: contributor})
	}
}

// contributorAdapter wraps a public `rule.Rule` so the engine's `Register`
// accepts it. Forward `Name` directly; convert `Visits` from `[]rule.Kind`
// (alias of `[]shimast.Kind`) to the engine's native slice; bridge `Check`
// by wrapping the engine's `*shimast.Node` and source file into the
// public `*rule.Node` / `*rule.File` wrappers before invoking the inner
// rule.
type contributorAdapter struct {
	inner rule.Rule
}

func (a contributorAdapter) Name() string { return a.inner.Name() }

func (a contributorAdapter) Visits() []shimast.Kind {
	facade := a.inner.Visits()
	if len(facade) == 0 {
		return nil
	}
	// `rule.Kind` is a type alias for `shimast.Kind`; the slice element
	// types match, but we still copy through a typed slice so a future
	// switch from alias to named type would surface here as a build
	// break instead of a silent layout difference.
	out := make([]shimast.Kind, len(facade))
	for i, k := range facade {
		out[i] = k
	}
	return out
}

func (a contributorAdapter) Check(ctx *Context, node *shimast.Node) {
	if ctx == nil || node == nil {
		return
	}
	pubFile := rule.WrapFile(ctx.File)
	pubNode := rule.WrapNode(node, ctx.File)
	pubCtx := rule.NewContext(
		pubFile,
		ctx.Checker,
		rule.Severity(ctx.Severity),
		contextReporter{ctx: ctx},
	)
	a.inner.Check(pubCtx, pubNode)
}

// contextReporter forwards `rule.Reporter` calls back to the host's
// existing collect pipeline. Unwraps `*rule.Node` to `*shimast.Node`
// because the engine's `Context.Report` already speaks shim types.
type contextReporter struct {
	ctx *Context
}

func (r contextReporter) Report(node *rule.Node, message string) {
	if node == nil {
		return
	}
	r.ctx.Report(node.Inner(), message)
}

func (r contextReporter) ReportRange(pos, end int, message string) {
	r.ctx.ReportRange(pos, end, message)
}
