declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/await-async-queries: `findBy*` results must be awaited.
 *
 * Locks the parent-shape check that reports any `findBy*` query whose call is
 * neither awaited nor chained into `.then(...)`.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Call `screen.findByText(...)` as a standalone statement.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen } from "@testing-library/react";

function testCase() {
  // expect: testing-library/await-async-queries error
  screen.findByText("Saved");
}

void testCase;
