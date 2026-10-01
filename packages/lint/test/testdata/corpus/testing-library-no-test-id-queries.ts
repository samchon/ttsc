declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/no-test-id-queries: `getByTestId` style queries are rejected.
 *
 * Locks the identifier check across `getByTestId`, `queryByTestId`,
 * `findByTestId`, and `*AllByTestId`. The rule pushes users toward
 * accessibility-driven queries.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Call `screen.getByTestId(...)`.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen } from "@testing-library/react";

function testCase() {
  // expect: testing-library/no-test-id-queries error
  return screen.getByTestId("save");
}

void testCase;
