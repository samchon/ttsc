/**
 * Verifies solid/jsx-no-duplicate-props: duplicate attributes are rejected.
 *
 * Pins the rule that fires when the same JSX attribute name appears twice on
 * one element. Solid would silently keep only the last value, hiding the
 * conflicting intent behind a quiet override.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Render a `<div>` with two `id` attributes.
 */
import { createSignal } from "solid-js";

createSignal(0);

// expect: solid/jsx-no-duplicate-props error
const tree = <div id="a" id="b" />;

JSON.stringify({ tree });
