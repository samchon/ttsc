declare const render: any;
declare const screen: any;
declare const fireEvent: any;
declare const waitFor: any;
declare const userEvent: any;
declare const cleanup: any;
declare const act: any;
/**
 * Verifies testing-library/no-dom-import: direct `@testing-library/dom` imports are rejected.
 *
 * Locks the import-source check: framework adapters re-export the DOM helpers,
 * so reaching into the low-level package is reported.
 *
 * 1. Import a helper from `@testing-library/dom` directly.
 * 2. Reference the imported symbol.
 * 3. Assert the matching diagnostic.
 */
// expect: testing-library/no-dom-import error
// @ts-ignore
import { prettyDOM } from "@testing-library/dom";
// @ts-ignore
import { render } from "@testing-library/react";

declare const node: unknown;

function testCase() {
  render(node as never);
  prettyDOM(document.body);
}

void testCase;
