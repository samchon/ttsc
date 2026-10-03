declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/await-async-utils: `waitFor` calls must be awaited.
 *
 * Pins the async-utility list (`waitFor`, `waitForElementToBeRemoved`, ...) and
 * the parent-shape check that requires an `await` or `then` on the call.
 *
 * 1. Import `screen` and `waitFor` from Testing Library.
 * 2. Call `waitFor(...)` as a standalone statement.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen, waitFor } from "@testing-library/react";

function testCase() {
  // expect: testing-library/await-async-utils error
  waitFor(() => screen.getByText("Done"));
}

void testCase;
