declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/no-manual-cleanup: manual `cleanup()` calls are rejected.
 *
 * Pins the imported-identifier check: framework adapters already register
 * cleanup, so an explicit `cleanup()` is redundant and reported.
 *
 * 1. Import `cleanup` from a Testing Library adapter.
 * 2. Call `cleanup()` directly.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { cleanup } from "@testing-library/react";

function testCase() {
  // expect: testing-library/no-manual-cleanup error
  cleanup();
}

void testCase;
