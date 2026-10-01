declare function useEffect(effect: () => void, deps: ReadonlyArray<unknown>): void;

function Component(props: { value: number }) {
  // Positive: deps array omits `props.value`.
  useEffect(() => {
    JSON.stringify(props.value);
    // expect: react/exhaustive-deps error
  }, []);

  // Negative: deps array lists every reactive identifier.
  useEffect(() => {
    JSON.stringify(props.value);
  }, [props.value]);

  return null;
}

JSON.stringify(Component);
