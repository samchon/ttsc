declare function useMemo<T>(factory: () => T, deps: ReadonlyArray<unknown>): T;

function Component() {
  // Positive: block-bodied `useMemo` callback with no return.
  // expect: react/use-memo error
  const value = useMemo(() => {
    JSON.stringify("compute");
  }, []);

  return <div>{JSON.stringify(value)}</div>;
}

JSON.stringify(Component);
