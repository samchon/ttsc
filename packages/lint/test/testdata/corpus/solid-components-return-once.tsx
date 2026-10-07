/**
 * Verifies solid/components-return-once: components must have a single return path.
 *
 * Pins the rule that rejects early returns inside Solid components. Multiple
 * return statements would re-run the component body and recreate reactive
 * primitives, breaking the once-only setup contract.
 *
 * 1. Define a component with an early `return <span />` guard.
 * 2. Fall through to a second `return` with the main JSX.
 */
import { Component } from "solid-js";

const App: Component<{ name: string }> = (props) => {
  // expect: solid/components-return-once error
  if (!props.name) return <span />;
  return <strong>{props.name}</strong>;
};

JSON.stringify({ App });
