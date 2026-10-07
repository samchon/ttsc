declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/no-await-sync-events: `fireEvent` must not be awaited.
 *
 * Locks the negative of the async-events rule: `fireEvent.*` is synchronous,
 * so awaiting the call is reported as a useless `await`.
 *
 * 1. Import `fireEvent` and `screen` from Testing Library.
 * 2. Await a `fireEvent.click(...)` call.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { fireEvent, screen } from "@testing-library/react";

async function testCase() {
  // expect: testing-library/no-await-sync-events error
  await fireEvent.click(screen.getByText("Save"));
}

void testCase;
