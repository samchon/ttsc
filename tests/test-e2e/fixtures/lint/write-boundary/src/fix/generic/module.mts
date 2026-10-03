const identity = <T extends unknown>(value: T): T => value;

console.log(identity(1));
export {};
