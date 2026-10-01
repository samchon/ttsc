import type { Model } from "./nested/model";
import { helper } from "./helpers";

const message: string = "api-ok";
console.log(message);
export const upper: string = helper(message);
export const model = { value: message } satisfies Model;
