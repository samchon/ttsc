package linthost

import "testing"

// TestCommandFormatTerminatesASplitInterfaceMember verifies the cascade
// expands one-line interface bodies and terminates every resulting member.
//
// The two-member input already has an interior separator, while the final
// member and the sole member have no terminator. Complete independent output
// literals require uniform termination after expansion, preserving interface
// names, member order and types. No individual cascade pass is observed.
//
//  1. Seed one-member and two-member interfaces written on one line.
//  2. Run `ttsc format`.
//  3. Assert the complete authored output, with every member terminated.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on two one-line interfaces (one member, and two members with the last unterminated) and requires the exact output with each body split over lines and every member, including the last, ending in `;`.
// @evidence contracts/testing.md#independent-expectations The complete authored expected text preserves Alpha/Bravo, each member name and number/string type while requiring expanded bodies and final semicolons. No expected text is derived from actual formatter output or an external formatter invocation.
// @evidence contracts/testing.md#distinguishing-cases A one-member and a two-member body separate a last member with no separator from one whose interior terminator already exists; both must end uniformly terminated.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatResult; no child process, built binary or installed consumer.
func TestCommandFormatTerminatesASplitInterfaceMember(t *testing.T) {
  assertFormatResult(
    t,
    "export interface Alpha { alpha: number }\n"+
      "export interface Bravo { alpha: number; bravo: string }\n",
    "export interface Alpha {\n"+
      "  alpha: number;\n"+
      "}\n"+
      "export interface Bravo {\n"+
      "  alpha: number;\n"+
      "  bravo: string;\n"+
      "}\n",
  )
}
