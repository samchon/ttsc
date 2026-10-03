declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/no-render-in-lifecycle: `render()` inside lifecycle hooks is rejected.
 *
 * Locks the ancestor walk from a `render()` call back to test lifecycle
 * callbacks. Tests sharing the same render across cases lose isolation.
 *
 * 1. Import `render` from Testing Library.
 * 2. Call `render(...)` inside a `beforeEach` callback.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { render } from "@testing-library/react";

declare const node: unknown;
declare const beforeEach: (cb: () => void) => void;

beforeEach(() => {
  // expect: testing-library/no-render-in-lifecycle error
  render(node as never);
});
