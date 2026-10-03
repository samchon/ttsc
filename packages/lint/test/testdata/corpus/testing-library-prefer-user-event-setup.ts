declare module "@testing-library/user-event" { const x: any; export = x; }
declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/prefer-user-event-setup: direct `userEvent.<event>` is rejected.
 *
 * Locks the rule that distinguishes `userEvent.setup()` (allowed, creates the
 * instance) from a direct event call on the default object (reported, should
 * go through the setup result).
 *
 * 1. Import the default user-event object.
 * 2. Call `userEvent.click(...)` without `userEvent.setup()`.
 * 3. Assert the matching diagnostic.
 */
import userEvent from "@testing-library/user-event";

function testCase() {
  // expect: testing-library/prefer-user-event-setup error
  userEvent.click(document.body);
}

void testCase;
