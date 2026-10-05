declare const console: { log(message: string): void };
console.log("dependency-secret-should-be-stripped");
export const tag: string = "dependency-value";
