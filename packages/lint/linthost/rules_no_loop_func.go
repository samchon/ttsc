// noLoopFunc reports a `function` declaration, function expression, or
// arrow function defined inside the body of a loop. The function value
// allocated each iteration almost always closes over the loop counter or
// some other binding that changes between iterations, so a deferred call
// (timer, microtask, event handler) observes whatever the binding holds
// at call time — usually the loop's terminal value, never the value the
// developer reasoned about at the textual position.
// https://eslint.org/docs/latest/rules/no-loop-func
//
// Conservative baseline: every function-like syntactically inside a loop
// body is flagged. Capture analysis (the rule's full upstream
// implementation only fires when the function actually closes over a
// `let` / `var` / `const` declared outside) is deferred; the false-
// positive rate is acceptable because the fix — hoist the function out
// of the loop — is almost always the cleaner code in either case.
//
// The walk stops at nested loop boundaries — each enclosing loop visits
// itself once, so an inner loop reports its own nested function-likes
// and the outer loop only owns the function-likes directly inside it.
// Inner function-likes are also boundaries: a closure inside an outer
// function-likes is that inner scope's problem.
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noLoopFunc struct{}

func (noLoopFunc) Name() string { return "no-loop-func" }
func (noLoopFunc) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindForStatement,
		shimast.KindForInStatement,
		shimast.KindForOfStatement,
		shimast.KindWhileStatement,
		shimast.KindDoStatement,
	}
}
func (noLoopFunc) Check(ctx *Context, node *shimast.Node) {
	var walk func(n *shimast.Node)
	walk = func(n *shimast.Node) {
		if n == nil {
			return
		}
		if isFunctionLikeKind(n) {
			ctx.Report(n, "Function declared in a loop closes over the loop's bindings — hoist it out.")
			return
		}
		if n != node && isLoopKind(n) {
			// Nested loops report their own contents when visited.
			return
		}
		n.ForEachChild(func(child *shimast.Node) bool {
			walk(child)
			return false
		})
	}
	node.ForEachChild(func(child *shimast.Node) bool {
		walk(child)
		return false
	})
}

// isLoopKind reports whether n is one of the loop statement kinds this
// rule visits. Used to stop the walk at a nested loop boundary so each
// loop reports only the function-likes directly inside its own body.
func isLoopKind(n *shimast.Node) bool {
	if n == nil {
		return false
	}
	switch n.Kind {
	case shimast.KindForStatement,
		shimast.KindForInStatement,
		shimast.KindForOfStatement,
		shimast.KindWhileStatement,
		shimast.KindDoStatement:
		return true
	}
	return false
}

func init() {
	Register(noLoopFunc{})
}
