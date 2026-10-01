/**
 * Verifies testing-library/no-wait-for-snapshot: snapshot matchers inside `waitFor` are rejected.
 *
 * Pins the matcher-name check inside a `waitFor` callback: `toMatchSnapshot`
 * and `toMatchInlineSnapshot` re-snapshot on every retry, which is wrong.
 *
 * 1. Import `screen` and `waitFor` from Testing Library.
 * 2. Use `toMatchSnapshot()` inside a `waitFor` callback.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen, waitFor } from "@testing-library/react";

declare const expect: (value: unknown) => { toMatchSnapshot(): void };

async function testCase() {
  // expect: testing-library/no-wait-for-snapshot error
  await waitFor(() => {
    expect(screen.getByText("B")).toMatchSnapshot();
  });
}

void testCase;
