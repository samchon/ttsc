export interface Payload {
  readonly value: string;
}

export const payload: Payload = { value: "before" };

console.log(payload.value);
