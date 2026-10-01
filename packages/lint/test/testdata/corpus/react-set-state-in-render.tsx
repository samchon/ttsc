declare function useState<T>(initial: T): [T, (next: T) => void];

function Component() {
  const [value, setValue] = useState(0);
  // Positive: calling the setter directly during render.
  // expect: react/set-state-in-render error
  setValue(1);
  return <div>{value}</div>;
}

JSON.stringify(Component);
