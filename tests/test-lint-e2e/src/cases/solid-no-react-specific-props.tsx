/**
 * Verifies solid/no-react-specific-props: React-only prop names are rejected.
 *
 * Pins the rule that flags `className`, `htmlFor`, and `key` on JSX elements.
 * Solid uses `class`, `for`, and stable references instead; the React names
 * are forwarded to the DOM as unknown attributes and silently drop styling.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Render a `<label>` with `className`, `htmlFor`, and `key` attributes.
 */
import { createSignal } from "solid-js";

createSignal(0);

// expect: solid/no-react-specific-props error
// expect: solid/no-react-specific-props error
// expect: solid/no-react-specific-props error
const tree = <label className="primary" htmlFor="field" key="save" />;

JSON.stringify({ tree });
