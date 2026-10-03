const tsxIdentity = <T extends unknown>(value: T): T => value;
const anyIdentity = <T extends any>(value: T): T => value;
const pair = <T extends unknown, U>(left: T, right: U): [T, U] => [left, right];
const existing = <T extends any,>(value: T): T => value;
const defaulted = <T extends unknown = string>(value?: T): T | undefined => value;
const commented = <T extends unknown /* keep */,>(value: T): T => value;

interface Box<T extends unknown> {
  value: T;
}
type Alias<T extends any> = T;
class Store<T extends unknown> {
  method<U extends any>(value: U): U {
    return value;
  }
}
function declared<T extends unknown>(value: T): T {
  return value;
}

console.log({
  tsxIdentity,
  anyIdentity,
  pair,
  existing,
  defaulted,
  commented,
  declared,
});
export type { Alias, Box, Store };
