export interface Payload { value: number }
export const payload: Payload = { value: 42 };
export const __TTSC_NATIVE_FACTORY_ARROW__: (input: Payload) => number = (input) => input.value + 1;
const unchanged = (input: Payload): number => input.value + 1;
export const observed = {
  generated: __TTSC_NATIVE_FACTORY_ARROW__(payload),
  neighbor: unchanged(payload),
  payload: payload.value,
};
