/**
 * Verifies testing-library/prefer-implicit-assert: redundant `toBeInTheDocument` around `getBy*` is rejected.
 *
 * Locks the matcher-name walk from `toBeInTheDocument()` back to the wrapped
 * `expect` argument: a `getBy*` query already asserts presence, so the
 * matcher is redundant.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Wrap `screen.getByText(...)` in `expect(...).toBeInTheDocument()`.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen } from "@testing-library/react";

declare const expect: (value: unknown) => { toBeInTheDocument(): void };

function testCase() {
  // expect: testing-library/prefer-implicit-assert error
  expect(screen.getByText("Save")).toBeInTheDocument();
}

void testCase;
