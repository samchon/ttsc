declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/no-wait-for-side-effects: side-effects inside `waitFor` are rejected.
 *
 * Locks the descendant scan inside a `waitFor` callback: `fireEvent` and other
 * mutating calls retry along with the assertion, which is rarely intended.
 *
 * 1. Import `fireEvent`, `screen`, and `waitFor` from Testing Library.
 * 2. Call `fireEvent.click(...)` inside a `waitFor` callback.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { fireEvent, screen, waitFor } from "@testing-library/react";

async function testCase() {
  // expect: testing-library/no-wait-for-side-effects error
  await waitFor(() => {
    fireEvent.click(screen.getByText("Go"));
  });
}

void testCase;
