package lint

import "testing"

func TestForDirection(t *testing.T) {
	assertFindings(t, forDirection{}, "for (let i = 0; i < 10; i--) {}", SeverityError, []string{
		"The update clause in this loop moves the variable in the wrong direction.",
	})
	assertFindings(t, forDirection{}, "for (let i = 10; i > 0; i++) {}", SeverityError, []string{
		"The update clause in this loop moves the variable in the wrong direction.",
	})
	assertFindings(t, forDirection{}, "for (let i = 0; i < 10; i++) {}", SeverityError, nil)
	assertFindings(t, forDirection{}, "for (let i = 10; i > 0; i--) {}", SeverityError, nil)
	assertFindings(t, forDirection{}, "for (let i = 0; i < 10; i += 2) {}", SeverityError, nil)
}
