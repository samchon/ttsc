const source = {
  state: "ready",
  count: 1,
  nested: { enabled: true },
  extra: "value",
};
const values = [1, 2, 3];

export const {
  state,
  count: publicCount,
  nested: { enabled },
  ...remaining
} = source;
export const [first, , ...tail] = values;
const { extra: local } = source;
export { local as publicLocal };
const { state: hidden } = source;
