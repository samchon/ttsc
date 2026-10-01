declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/no-container: destructured `container` is rejected.
 *
 * Locks the destructuring detection: pulling `container` out of a `render()`
 * result is the primary anti-pattern this rule guards.
 *
 * 1. Import `render` from Testing Library.
 * 2. Destructure `container` from the `render(...)` call.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { render } from "@testing-library/react";

declare const node: unknown;

function testCase() {
  // expect: testing-library/no-container error
  const { container } = render(node as never);
  void container;
}

void testCase;
