declare function useState<T>(initial: T): [T, (next: T) => void];
declare function useEffect(effect: () => void, deps?: ReadonlyArray<unknown>): void;

function Component() {
  const [value, setValue] = useState(0);

  // Positive: synchronous setter inside a `useEffect` body.
  useEffect(() => {
    // expect: react/set-state-in-effect error
    setValue(1);
  }, []);

  return <div>{value}</div>;
}

JSON.stringify(Component);
