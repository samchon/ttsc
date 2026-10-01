declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/prefer-find-by: `getBy*` inside `waitFor` should become `findBy*`.
 *
 * Locks the callback shape `() => screen.getBy*(...)` inside a `waitFor`:
 * the dedicated `findBy*` query is the idiomatic replacement.
 *
 * 1. Import `screen` and `waitFor` from Testing Library.
 * 2. Wrap a `screen.getByText(...)` in a `waitFor` callback.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { screen, waitFor } from "@testing-library/react";

async function testCase() {
  // expect: testing-library/prefer-find-by error
  await waitFor(() => screen.getByText("Saved"));
}

void testCase;
