import { createSignal } from "solid-js";

createSignal(0);

declare const url: string;

// Positive: <p> cannot contain <div>.
const a = (
  <p>
    {/* expect: solid/validate-jsx-nesting error */}
    <div>block in paragraph</div>
  </p>
);

// Positive: <a> cannot contain another <a>.
const b = (
  <a href={url}>
    {/* expect: solid/validate-jsx-nesting error */}
    <a href={url}>inner</a>
  </a>
);

// Positive: <button> cannot contain <input>.
const c = (
  <button>
    {/* expect: solid/validate-jsx-nesting error */}
    <input />
  </button>
);

// Negative: <span> inside <p> is phrasing content and stays legal.
const d = (
  <p>
    <span>fine</span>
  </p>
);

JSON.stringify({ a, b, c, d });
