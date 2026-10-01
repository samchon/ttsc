declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/no-node-access: DOM traversal off a query result is rejected.
 *
 * Pins the AST check for `.parentElement` (and siblings) chained off any
 * Testing Library query — direct DOM walking defeats accessible queries.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Read `.parentElement` off a `screen.getBy*` result.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen } from "@testing-library/react";

function testCase() {
  // expect: testing-library/no-node-access error
  return screen.getByText("Save").parentElement;
}

void testCase;
