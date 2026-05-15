const numbers = [
  1,
  2,
  3,
];

const settings = {
  retries: 3,
  timeout: 1000,
};

function describe(
  label: string,
  payload: { name: string; value: number },
) {
  return JSON.stringify(
    {
      label,
      payload,
    },
    null,
    2,
  );
}

JSON.stringify({ numbers, settings, sample: describe("a", { name: "x", value: 1 }) });
