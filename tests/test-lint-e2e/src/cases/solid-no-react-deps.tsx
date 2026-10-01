/**
 * Verifies solid/no-react-deps: React-style dependency arrays are rejected.
 *
 * Pins the rule that flags a second positional argument to `createEffect`,
 * `createMemo`, or `createComputed`. Solid tracks dependencies automatically;
 * the extra array is a no-op carried over from `useEffect` and hides the
 * tracking model.
 *
 * 1. Import `createEffect` from Solid.
 * 2. Call `createEffect(() => {}, [])` with a dependency array.
 */
import { createEffect } from "solid-js";

// expect: solid/no-react-deps error
createEffect(() => {}, []);

JSON.stringify({ createEffect });
