/**
 * Verifies solid/jsx-no-script-url: `javascript:` URLs are rejected.
 *
 * Pins the rule that flags `href`/`src` literals starting with the
 * `javascript:` scheme. Solid would render the URL verbatim, exposing a
 * cross-site-scripting sink that the AST pass catches up front.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Render an `<a>` whose `href` is a `javascript:` URL.
 */
import { createSignal } from "solid-js";

createSignal(0);

// expect: solid/jsx-no-script-url error
const tree = <a href="javascript:alert(1)">click</a>;

JSON.stringify({ tree });
