/**
 * Verifies testing-library/no-wait-for-multiple-assertions: multiple expects inside `waitFor` are rejected.
 *
 * Pins the descendant scan inside a `waitFor` callback: more than one
 * `expect(...)` makes the retry semantics ambiguous.
 *
 * 1. Import `screen` and `waitFor` from Testing Library.
 * 2. Put two `expect(...)` assertions inside one `waitFor` callback.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen, waitFor } from "@testing-library/react";

declare const expect: (value: unknown) => { toBeTruthy(): void };

async function testCase() {
  // expect: testing-library/no-wait-for-multiple-assertions error
  await waitFor(() => {
    expect(screen.queryByText("A")).toBeTruthy();
    expect(screen.queryByText("B")).toBeTruthy();
  });
}

void testCase;
