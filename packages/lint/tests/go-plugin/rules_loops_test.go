package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestForDirection(t *testing.T) {
	assertFindings(t, "for-direction", "for (let i = 0; i < 10; i--) {}", lintpkg.SeverityError, []string{
		"The update clause in this loop moves the variable in the wrong direction.",
	})
	assertFindings(t, "for-direction", "for (let i = 10; i > 0; i++) {}", lintpkg.SeverityError, []string{
		"The update clause in this loop moves the variable in the wrong direction.",
	})
	assertFindings(t, "for-direction", "for (let i = 0; i < 10; i++) {}", lintpkg.SeverityError, nil)
	assertFindings(t, "for-direction", "for (let i = 10; i > 0; i--) {}", lintpkg.SeverityError, nil)
	assertFindings(t, "for-direction", "for (let i = 0; i < 10; i += 2) {}", lintpkg.SeverityError, nil)
}
