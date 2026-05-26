package linthost

import "testing"

/**
 * Verifies solid jsx-uses-vars: compatibility rule is accepted without diagnostics.
 *
 * Locks the deliberate no-op behavior documented for `solid/jsx-uses-vars`.
 * ESLint uses this rule to mark JSX identifiers as variable reads, but
 * @ttsc/lint does not run ESLint's unused-variable scope marker pass.
 *
 * 1. Import Solid so the Solid rule family is active.
 * 2. Enable only `solid/jsx-uses-vars`.
 * 3. Assert the rule is accepted and emits no findings.
 */
func TestSolidJsxUsesVarsIsConfigCompatOnly(t *testing.T) {
  source := `
import { createSignal } from "solid-js";

function App() {
  createSignal(0);
  const Button = () => <button />;
  return <Button />;
}
`
  assertSolidFindings(t, source, RuleConfig{
    "solid/jsx-uses-vars": SeverityError,
  }, nil)
}
