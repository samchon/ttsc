/**
 * Verifies solid/prefer-for: rendering arrays via `map` is rejected.
 *
 * Pins the rule that flags `array.map(item => <JSX />)` inside JSX. Solid
 * provides the `<For>` component for keyed list rendering; raw `map` reuses
 * stale DOM nodes and breaks fine-grained reconciliation.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Render `items().map(...)` directly inside a `<section>`.
 */
import { createSignal } from "solid-js";

const [items] = createSignal([1, 2, 3]);

// expect: solid/prefer-for error
const tree = <section>{items().map((item) => <span>{item}</span>)}</section>;

JSON.stringify({ tree });
