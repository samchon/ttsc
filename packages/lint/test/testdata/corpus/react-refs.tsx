declare function useRef<T>(initial: T): { current: T };

function Component() {
  const ref = useRef<number>(0);
  // Positive: reading `ref.current` during render.
  // expect: react/refs error
  const value = ref.current;
  return <div>{value}</div>;
}

JSON.stringify(Component);
