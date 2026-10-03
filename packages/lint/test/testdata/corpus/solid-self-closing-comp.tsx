/**
 * Verifies solid/self-closing-comp: empty components must self-close.
 *
 * Pins the stylistic rule that flags `<Foo></Foo>` with no children. Solid
 * normalizes both forms identically, but the self-closing form keeps the
 * intent explicit at the call site.
 *
 * 1. Import Solid so the rule family activates.
 * 2. Render `<Icon></Icon>` with an empty body.
 */
import { Component, createSignal } from "solid-js";

createSignal(0);
const Icon: Component = () => <svg />;

// expect: solid/self-closing-comp error
const tree = <Icon></Icon>;

JSON.stringify({ tree });
