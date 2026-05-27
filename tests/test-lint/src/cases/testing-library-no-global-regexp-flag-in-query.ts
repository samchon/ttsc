declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/no-global-regexp-flag-in-query: `/g` regexes in queries are rejected.
 *
 * Locks the literal-argument check: a global `RegExp` flag in a Testing
 * Library query advances `lastIndex` between calls and produces flaky tests.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Pass a `/.../g` regex into `screen.getByText(...)`.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen } from "@testing-library/react";

function testCase() {
  // expect: testing-library/no-global-regexp-flag-in-query error
  return screen.getByText(/save/g);
}

void testCase;
