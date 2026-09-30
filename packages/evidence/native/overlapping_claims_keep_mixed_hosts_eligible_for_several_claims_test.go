package evidence

import "testing"

/**
 * Verifies a mixed host can participate in every selector it actually has.
 *
 * TypeScript attaches one JSDoc block to a mixed variable statement whose
 * declarations classify as a function and a property. Choosing one owner would
 * make the other claim report missing even though the physical host supports
 * both selectors.
 *
 *  1. Put a function and property in one exported variable statement.
 *  2. Match the file from separate function and property claims.
 *  3. Assert the shared declaration satisfies both obligations.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule selects an exported execute/value statement through function and property claims; its shared block must satisfy both cleanly.
 * @evidence contracts/testing.md#independent-expectations One physical documentation host may legitimately support both semantic selectors in a mixed declaration.
 * @evidence contracts/testing.md#distinguishing-cases Callable execute and data value challenge single-owner assignment; silence would not distinguish loss of one claim's activation.
 * @evidence contracts/testing.md#execution-ownership TestOverlappingClaimsKeepMixedHostsEligibleForSeveralClaims is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestOverlappingClaimsKeepMixedHostsEligibleForSeveralClaims(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/mixed.ts": `
/** @evidence docs/spec.md#contract Both exports implement this contract. */
export const execute = (): void => {}, value = 1;
`,
  }, `{"claims":[
    {
      "type":"typescript",
      "files":["src/mixed.ts"],
      "symbol":"function",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "files":["src/mixed.ts"],
      "symbol":"property",
      "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
    }
  ]}`)
  assertNoProblems(t, messages)
}
