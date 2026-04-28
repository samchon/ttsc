package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoUnsafeFinally(t *testing.T) {
	const source = `
		function f() {
			try {
				throw new Error("x");
			} finally {
				return 1;
			}
		}
	`
	assertFindings(t, "no-unsafe-finally", source, lintpkg.SeverityError, []string{
		"Unsafe usage of return.",
	})
}

func TestNoUnsafeFinallyAllowsInnerLoopBreak(t *testing.T) {
	const source = `
		function f() {
			try {
				return 0;
			} finally {
				for (let i = 0; i < 3; i++) {
					if (i === 2) break;
				}
			}
		}
	`
	assertFindings(t, "no-unsafe-finally", source, lintpkg.SeverityError, nil)
}

func TestNoUnsafeFinallyAllowsInnerFunction(t *testing.T) {
	const source = `
		function f() {
			try {
				return 0;
			} finally {
				const g = () => { return 1; };
				g();
			}
		}
	`
	assertFindings(t, "no-unsafe-finally", source, lintpkg.SeverityError, nil)
}

func TestNoUselessCatch(t *testing.T) {
	const source = `
		function f() {
			try {
				doStuff();
			} catch (e) {
				throw e;
			}
		}
	`
	assertFindings(t, "no-useless-catch", source, lintpkg.SeverityError, []string{
		"Unnecessary try/catch wrapper.",
	})
}

func TestNoUselessCatchAllowsFinally(t *testing.T) {
	const source = `
		function f() {
			try {
				doStuff();
			} catch (e) {
				throw e;
			} finally {
				cleanup();
			}
		}
	`
	assertFindings(t, "no-useless-catch", source, lintpkg.SeverityError, nil)
}
