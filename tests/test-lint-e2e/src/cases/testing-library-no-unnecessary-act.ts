declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/no-unnecessary-act: wrapping Testing Library calls in `act()` is rejected.
 *
 * Pins the `act()` callback scan: `fireEvent` and other Testing Library
 * helpers are already wrapped in `act()` internally, so a manual `act(...)`
 * is redundant.
 *
 * 1. Import `act`, `fireEvent`, and `screen` from Testing Library.
 * 2. Wrap a `fireEvent.click(...)` call in `act(() => ...)`.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { act, fireEvent, screen } from "@testing-library/react";

function testCase() {
  // expect: testing-library/no-unnecessary-act error
  act(() => {
    fireEvent.click(screen.getByRole("button"));
  });
}

void testCase;
