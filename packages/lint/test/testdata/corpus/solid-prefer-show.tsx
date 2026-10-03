/**
 * Verifies solid/prefer-show: conditional JSX via `&&` is rejected.
 *
 * Pins the rule that flags `cond && <JSX />` inside JSX children. Solid's
 * `<Show>` component handles conditional rendering with proper teardown; the
 * `&&` form leaks subscriptions when the condition flips repeatedly.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Render `enabled && <strong>...</strong>` inside JSX.
 */
import { createSignal } from "solid-js";

const [enabled] = createSignal(true);

// expect: solid/prefer-show error
const tree = <section>{enabled() && <strong>Ready</strong>}</section>;

JSON.stringify({ tree });
