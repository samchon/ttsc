/**
 * Verifies solid/imports: Solid APIs must come from their canonical modules.
 *
 * Pins the rule that fires when an export is imported from the wrong Solid
 * package (e.g. `render` from `solid-js` instead of `solid-js/web`). Imports
 * from incorrect subpaths build but break at runtime in different
 * environments.
 *
 * 1. Import `render` from `solid-js` instead of `solid-js/web`.
 * 2. Import `createStore` from `solid-js/web` instead of `solid-js/store`.
 */
// expect: solid/imports error
import { createEffect, render } from "solid-js";
// expect: solid/imports error
import { createStore } from "solid-js/web";

JSON.stringify({ createEffect, render, createStore });
