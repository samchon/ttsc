function Component(props: { value: { count: number } }) {
  // Positive: directly mutating a prop during render.
  // expect: react/immutability error
  props.value.count = 1;
  return <div>{props.value.count}</div>;
}

// Negative: producing a new object instead of mutating.
function Pure(props: { value: { count: number } }) {
  const next = { ...props.value, count: props.value.count + 1 };
  return <div>{next.count}</div>;
}

JSON.stringify({ Component, Pure });
