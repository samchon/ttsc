/**
 * Verifies solid/no-destructure: destructuring component props loses reactivity.
 *
 * Pins the rule that flags destructured parameters on Solid components. Props
 * are reactive accessors, so destructuring at the parameter list reads them
 * once at mount and breaks downstream updates.
 *
 * 1. Define a Solid component that destructures `name` in its parameter list.
 * 2. Render the destructured value in JSX.
 */
import { Component } from "solid-js";

// expect: solid/no-destructure error
const Hello: Component<{ name: string }> = ({ name }) => <span>{name}</span>;

JSON.stringify({ Hello });
