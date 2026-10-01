declare function useState<T>(initial: T): [T, (next: T) => void];

// Positive: nested factory that returns a Hook calling Hooks.
function Component() {
  // expect: react/component-hook-factories error
  function useNested() {
    const [value] = useState(0);
    return value;
  }
  return <div>{useNested()}</div>;
}

// Negative: hook declared at module scope.
function useOuter() {
  const [value] = useState(0);
  return value;
}

JSON.stringify({ Component, useOuter });
