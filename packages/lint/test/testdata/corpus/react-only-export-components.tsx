// Positive: a module that exports both a component and a non-component.
// expect: react/only-export-components error
export const helper = 1;

export function Widget() {
  return <div>hi</div>;
}

JSON.stringify({ helper, Widget });
