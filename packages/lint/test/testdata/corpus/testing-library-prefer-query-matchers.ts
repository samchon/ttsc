/**
 * Verifies testing-library/prefer-query-matchers: truthiness matchers around queries are rejected.
 *
 * Locks the matcher-name check for `toBeNull`, `toBeTruthy`, and `toBeFalsy`
 * when the `expect` argument is a Testing Library query. Such assertions
 * should use jest-dom document matchers instead.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Assert a `queryBy*` result with `toBeNull()`.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen } from "@testing-library/react";

declare const expect: (value: unknown) => { toBeNull(): void };

function testCase() {
  // expect: testing-library/prefer-query-matchers error
  expect(screen.queryByText("Save")).toBeNull();
}

void testCase;
