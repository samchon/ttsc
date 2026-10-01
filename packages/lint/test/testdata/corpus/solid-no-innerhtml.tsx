/**
 * Verifies solid/no-innerhtml: `innerHTML` props are rejected.
 *
 * Pins the rule that fires on a JSX `innerHTML` attribute. Solid evaluates the
 * expression as raw HTML at runtime, bypassing the reconciler and opening an
 * unchecked HTML injection sink.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Render a `<div>` with an `innerHTML` attribute reading a signal.
 */
import { createSignal } from "solid-js";

const [html] = createSignal("<b>x</b>");

// expect: solid/no-innerhtml error
const tree = <div innerHTML={html()} />;

JSON.stringify({ tree });
