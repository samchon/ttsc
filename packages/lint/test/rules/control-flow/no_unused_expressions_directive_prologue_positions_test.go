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
