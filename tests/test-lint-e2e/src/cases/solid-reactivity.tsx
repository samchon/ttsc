/**
 * Verifies solid/reactivity: bare signal accessors break fine-grained tracking.
 *
 * Pins the reactivity branch that fires when a signal getter is referenced
 * without being called in a tracked scope, which would freeze the value at
 * mount time and silently break Solid's reactivity graph.
 *
 * 1. Create a signal and read its accessor inside a `createEffect`.
 * 2. Return the accessor as a bare JSX child rather than invoking it.
 */
import { createEffect, createSignal } from "solid-js";

function App() {
  const [count] = createSignal(0);
  createEffect(() => count());
  // expect: solid/reactivity error
  return <span>{count}</span>;
}

JSON.stringify({ App });
