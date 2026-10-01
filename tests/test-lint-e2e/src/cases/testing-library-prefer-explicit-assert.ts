declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/prefer-explicit-assert: standalone `getBy*` queries are rejected.
 *
 * Pins the parent-shape check that distinguishes a bare `getBy*` query from a
 * query used inside an explicit assertion. Standalone queries should not act
 * as implicit assertions when this stricter rule is enabled.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Call `screen.getByText(...)` as a standalone statement.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen } from "@testing-library/react";

function testCase() {
  // expect: testing-library/prefer-explicit-assert error
  screen.getByText("Save");
}

void testCase;
