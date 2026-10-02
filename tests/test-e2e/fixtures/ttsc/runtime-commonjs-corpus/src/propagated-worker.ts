import { value } from "worker-dep";
declare const console: { log(message: string): void };
console.log("worker:" + value);
