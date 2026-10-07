declare module "@testing-library/user-event" { const x: any; export = x; }
declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/await-async-events: user-event calls must be awaited.
 *
 * Pins the AST-only check that flags Promise-returning user-event helpers when
 * their call expression is not awaited.
 *
 * 1. Import the default user-event object.
 * 2. Invoke `userEvent.click(...)` without `await`.
 * 3. Assert the matching diagnostic.
 */
import userEvent from "@testing-library/user-event";

function testCase() {
  // expect: testing-library/await-async-events error
  userEvent.click(document.body);
}

void testCase;
