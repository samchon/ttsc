/**
 * Verifies solid/no-array-handlers: array-form event handlers are rejected.
 *
 * Pins the rule that flags `onEvent={[arg, fn]}` shapes. Solid does support a
 * `[handler, data]` bound-handler form, but the rule disables it because the
 * tuple is easily mistaken for a React-style dependency array.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Render a `<button>` whose `onClick` is a `[signal, fn]` tuple.
 */
import { createSignal } from "solid-js";

const [enabled] = createSignal(false);

// expect: solid/no-array-handlers error
const tree = <button onClick={[enabled, () => enabled()]}>x</button>;

JSON.stringify({ tree });
