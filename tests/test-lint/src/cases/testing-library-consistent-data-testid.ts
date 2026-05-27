// @ttsc-corpus-skip: rule requires a configured `testIdPattern` option; the corpus runner enables every rule with a bare `error` severity and does not synthesize per-rule options.
declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/consistent-data-testid: test-id strings must match a configured pattern.
 *
 * Pins the option-driven branch: `testIdPattern` is decoded through
 * `Context.DecodeOptions`, then enforced on every `getByTestId(...)` literal.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Call `getByTestId(...)` with an id that violates the default pattern.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen } from "@testing-library/react";

function testCase() {
  // expect: testing-library/consistent-data-testid error
  return screen.getByTestId("Bad Value");
}

void testCase;
