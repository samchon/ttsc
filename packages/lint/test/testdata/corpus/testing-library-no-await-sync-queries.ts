declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/no-await-sync-queries: `getBy*` / `queryBy*` must not be awaited.
 *
 * Pins the rule that catches a useless `await` on a synchronous query
 * (`getBy*`, `queryBy*`) imported from Testing Library.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Await a `screen.getByText(...)` call.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen } from "@testing-library/react";

async function testCase() {
  // expect: testing-library/no-await-sync-queries error
  await screen.getByText("Ready");
}

void testCase;
