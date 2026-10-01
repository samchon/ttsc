declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/no-debugging-utils: leftover `debug()` calls are rejected.
 *
 * Pins the destructured-debug branch: pulling `debug` out of `render()` and
 * invoking it is the common way debug calls get committed by accident.
 *
 * 1. Import `render` from Testing Library.
 * 2. Destructure `debug` from `render(...)` and call it.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { render } from "@testing-library/react";

declare const node: unknown;

function testCase() {
  const { debug } = render(node as never);
  // expect: testing-library/no-debugging-utils error
  debug();
}

void testCase;
