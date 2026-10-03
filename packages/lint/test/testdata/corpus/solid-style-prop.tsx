/**
 * Verifies solid/style-prop: camelCased CSS keys are rejected.
 *
 * Pins the rule that flags `style={{ fontSize: ... }}` object literals. Solid
 * forwards the style object to `element.style.setProperty`, which expects
 * kebab-case CSS property names; camelCase keys are silently ignored.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Render a `<span>` whose `style` uses `fontSize` instead of `font-size`.
 */
import { createSignal } from "solid-js";

createSignal(0);

// expect: solid/style-prop error
const tree = <span style={{ fontSize: "12px" }} />;

JSON.stringify({ tree });
