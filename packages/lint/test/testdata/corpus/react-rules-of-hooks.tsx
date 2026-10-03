declare function useState<T>(initial: T): [T, (next: T) => void];

// Positive: Hook call inside a conditional branch.
function Component({ enabled }: { enabled: boolean }) {
  if (enabled) {
    // expect: react/rules-of-hooks error
    const [value] = useState(0);
    JSON.stringify(value);
  }
  return null;
}

// Negative: Hook call at the top of the component body.
function Good() {
  const [value] = useState(0);
  return <div>{value}</div>;
}

JSON.stringify({ Component, Good });
