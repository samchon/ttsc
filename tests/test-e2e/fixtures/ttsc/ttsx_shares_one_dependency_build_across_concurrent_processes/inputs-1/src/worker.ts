import { value } from "shared-dep";
declare const console: { log(message: string): void };
console.log("worker:" + value);
