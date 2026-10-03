package linthost

import "testing"

// TestJsxA11yAutocompleteValidRejectsInvalidTokenSequence verifies token grammar.
//
// Contact qualifiers apply only to contact purposes, and every detail list has
// exactly one purpose, optionally followed by webauthn. This case follows
// the upstream validator in requiring a suffix after section-; that check
// is stricter than the HTML specification's section-prefix wording.
//
// 1. Parse qualified, multiple-purpose, mixed-state, and empty-section lists.
// 2. Enable only `jsx-a11y/autocomplete-valid`.
// 3. Assert every invalid sequence reports a diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify qualifier, multiple-purpose, mixed state and empty-section lists are invalid; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations The authored ordered contact list follows HTML token order; upstream jsx-a11y's axe-core isValidAutocomplete additionally requires a section-name suffix and rejects section- name. That independently implemented compatibility policy supplies this stricter expectation; it is not claimed to follow the literal HTML section-prefix wording or sampled ttsc output.
// @evidence contracts/testing.md#distinguishing-cases home url, name email and on email reject incompatible or multiple purpose/state positions; section- name reports under the stricter upstream section-name policy. section-blue shipping home email is the ordered clean counterpart.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAutocompleteValidRejectsInvalidTokenSequence owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAutocompleteValidRejectsInvalidTokenSequence(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete="home url" />;`, "invalid token sequence")
  assertJsxA11yRuleFinds(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete="name email" />;`, "invalid token sequence")
  assertJsxA11yRuleFinds(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete="on email" />;`, "invalid token sequence")
  assertJsxA11yRuleFinds(t, "jsx-a11y/autocomplete-valid", `const Component = () => <input autoComplete="section- name" />;`, "invalid token sequence")
  assertJsxA11yRuleSkips(t, "jsx-a11y/autocomplete-valid", "declare const props: object; const Component = () => <input type=\"email\" autoComplete=\"section-blue shipping home email\" />;")
}
