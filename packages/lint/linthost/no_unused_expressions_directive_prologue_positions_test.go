package linthost

import "testing"

// TestNoUnusedExpressionsDirectiveProloguePositions verifies no-unused-expressions accepts directive prologues in every legal position.
//
// Locks `noUnusedExpressionsIsDirective` / `noUnusedExpressionsCanOwnPrologue`:
// the directive prologue is positional, so an arbitrary-text leading string
// run must be exempt at a module's top and at the top of function
// declarations, function expressions, arrows, methods, constructors,
// accessors, and namespace bodies — with no recognized-text whitelist
// involved (the old implementation only accepted "use strict"/"use asm").
//
//  1. Parse a module placing arbitrary directive strings at every
//     prologue-capable position.
//  2. Run the native Engine with only no-unused-expressions enabled.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings for all original arbitrary-string directive prologues across supported declaration positions.
// @evidence contracts/testing.md#independent-expectations A prologue string need not spell use strict; independently authored program/function/method/namespace contexts supply the supported exemption.
// @evidence contracts/testing.md#distinguishing-cases Program, function declaration/expression/arrow, constructor/method/accessors and namespace prologues stay clean; DirectiveBoundaries owns late, parenthesized and class-static negatives.
// @evidence contracts/testing.md#execution-ownership TestNoUnusedExpressionsDirectiveProloguePositions is selected in the shared Go unit population. It calls assertRuleSkipsSource with the entire original prologue-position source through the AST Engine. No installed consumer, native artifact build or real product host runs.
func TestNoUnusedExpressionsDirectiveProloguePositions(t *testing.T) {
  assertRuleSkipsSource(t, "no-unused-expressions", `"use strict";
"use client";
"any arbitrary prologue text";

export function decl(): void {
  "use function prologue";
  decl();
}

export const expr = function (): void {
  "use function expression prologue";
};

export const arrow = (): void => {
  "use arrow prologue";
};

export class Positions {
  constructor() {
    "use constructor prologue";
  }
  method(): void {
    "use method prologue";
  }
  get value(): number {
    "use getter prologue";
    return 1;
  }
  set value(next: number) {
    "use setter prologue";
    void next;
  }
}

export namespace Space {
  "use namespace prologue";
  export const marker: number = 1;
}
`)
}
