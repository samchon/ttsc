package linthost

import "testing"

// TestFormatSemiTerminatesBrokenInterfaceMembers verifies the always
// direction reaches every interface member kind, the last one included.
//
// The direct member insert path reaches all seven authored signature
// spellings in this broken interface, including the last setter. The full
// literal output specifies those edits; this entry does not execute body
// splitting or establish an earlier rule failure.

//  1. Parse an interface whose seven members are each on their own line
//     with no terminator.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert every member gained a `;`.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must append a semicolon to each of seven broken-interface member spellings while preserving every signature and property annotation.
// @evidence contracts/testing.md#independent-expectations The literal full output independently lists the required terminators for property, method, index, call, construct and get/set signatures under default semi policy.
// @evidence contracts/testing.md#distinguishing-cases All seven local member shapes, including the last setter, require a change; flat-interface singleton/pair negatives and already-terminated member cases own adjacent no-op layouts.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiTerminatesBrokenInterfaceMembers is a selected public Go unit under the lint semantic-unit Evidence claim. The shared syntax-only fixture harness calls the owning semicolon rule and applies edits for the complete literal output assertion in the same Go process without a consumer install, native product build or product host.
func TestFormatSemiTerminatesBrokenInterfaceMembers(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "interface Shape {\n"+
      "  value: string\n"+
      "  method(): void\n"+
      "  [key: string]: string\n"+
      "  (): void\n"+
      "  new (): Shape\n"+
      "  get first(): string\n"+
      "  set first(next: string)\n"+
      "}\n",
    "interface Shape {\n"+
      "  value: string;\n"+
      "  method(): void;\n"+
      "  [key: string]: string;\n"+
      "  (): void;\n"+
      "  new (): Shape;\n"+
      "  get first(): string;\n"+
      "  set first(next: string);\n"+
      "}\n",
  )
}
