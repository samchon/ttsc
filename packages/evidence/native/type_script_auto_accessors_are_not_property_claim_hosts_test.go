package evidence

import (
  "testing"
)

/**
 * Verifies a data auto-accessor is not a property claim host either.
 *
 * The property population is where an accessor most looks like it belongs, so
 * the exclusion has to hold on that side too. Without this twin, an accessor
 * refused as a callable could still slip in as a field and quietly discharge an
 * obligation the class never took.
 *
 *  1. Attach evidence to a data auto-accessor beside a real field.
 *  2. Select property hosts and one Markdown heading.
 *  3. Assert the declaration is reported as unsupported.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the declaration is reported as unsupported.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The property population is where an accessor most looks like it belongs, so the exclusion has to hold on that side too. Without this twin, an accessor refused as a callable could still slip in as a field and quietly discharge an obligation the class never took. The authored scenario requires this outcome: Assert the declaration is reported as unsupported.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Attach evidence to a data auto-accessor beside a real field. Select property hosts and one Markdown heading. Assert the declaration is reported as unsupported.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptAutoAccessorsAreNotPropertyClaimHosts runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptAutoAccessorsAreNotPropertyClaimHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/contracts.ts": `
export class Service {
  /** @evidence docs/spec.md#contract This accessor cannot claim property evidence. */
  accessor count = 0;
  retries: number = 3;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/contracts.ts"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "unsupported or non-exported declaration")
}
