/**
 * Verifies testing-library/prefer-query-by-disappearance: disappearance waits must use `queryBy*`.
 *
 * Locks the `waitFor` callback scan for a negated `toBeInTheDocument()`
 * assertion around a `getBy*` query — that pattern throws before the matcher
 * runs.
 *
 * 1. Import `screen` and `waitFor` from Testing Library.
 * 2. Wait for `not.toBeInTheDocument()` around `screen.getByText(...)`.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen, waitFor } from "@testing-library/react";

declare const expect: (value: unknown) => {
  not: { toBeInTheDocument(): void };
};

async function testCase() {
  // expect: testing-library/prefer-query-by-disappearance error
  await waitFor(() =>
    expect(screen.getByText("Saved")).not.toBeInTheDocument(),
  );
}

void testCase;
