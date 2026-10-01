/**
 * Verifies testing-library/prefer-presence-queries: presence and absence must use matching query families.
 *
 * Pins the positive branch: asserting presence with `queryBy*` (instead of
 * `getBy*`) loses the implicit existence check the matching query gives you.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Assert presence with `queryByText(...)` and `toBeInTheDocument()`.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen } from "@testing-library/react";

declare const expect: (value: unknown) => { toBeInTheDocument(): void };

function testCase() {
  // expect: testing-library/prefer-presence-queries error
  expect(screen.queryByText("Save")).toBeInTheDocument();
}

void testCase;
