/**
 * Verifies solid/event-handlers: lowercase string event handlers are rejected.
 *
 * Pins the rule that fires when a known DOM event prop is spelled lowercase
 * (`onclick`) and bound to a string. Solid treats these as plain attributes,
 * never wiring them as event listeners.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Render a `<button>` with an `onclick="save"` string attribute.
 */
import { createSignal } from "solid-js";

createSignal(0);

// expect: solid/event-handlers error
const tree = <button onclick="save">save</button>;

JSON.stringify({ tree });
