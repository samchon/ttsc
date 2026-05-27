declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/render-result-naming-convention: render results must be named `view`, `utils`, or destructured.
 *
 * Pins the binding-name check on a `const x = render(...)` declaration: a
 * non-conventional identifier (anything other than `view` / `utils`) is
 * reported.
 *
 * 1. Import `render` from Testing Library.
 * 2. Bind a `render(...)` result to a non-conventional name.
 * 3. Assert the matching diagnostic.
 */
// @ts-ignore
import { render } from "@testing-library/react";

declare const node: unknown;

function testCase() {
  // expect: testing-library/render-result-naming-convention error
  const wrapper = render(node as never);
  void wrapper;
}

void testCase;
