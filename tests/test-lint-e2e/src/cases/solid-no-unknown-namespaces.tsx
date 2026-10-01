/**
 * Verifies solid/no-unknown-namespaces: unknown JSX namespaces are rejected.
 *
 * Pins the rule that flags `ns:attr` JSX attributes whose namespace is not in
 * Solid's known set (e.g. `on:`, `oncapture:`, `use:`). Unknown namespaces are
 * forwarded raw to the DOM and almost always indicate a typo.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Render a `<div>` with a `foo:bar` namespaced attribute.
 */
import { createSignal } from "solid-js";

createSignal(0);

// expect: solid/no-unknown-namespaces error
const tree = <div foo:bar="x" />;

JSON.stringify({ tree });
