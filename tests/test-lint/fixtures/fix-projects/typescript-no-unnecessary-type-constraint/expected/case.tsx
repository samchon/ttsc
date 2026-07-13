const tsxIdentity = <T,>(value: T): T => value;
const anyIdentity = <T,>(value: T): T => value;
const pair = <T, U>(left: T, right: U): [T, U] => [left, right];
const existing = <T,>(value: T): T => value;
const defaulted = <T = string>(value?: T): T | undefined => value;
const commented = <T /* keep */,>(value: T): T => value;

interface Box<T> {
  value: T;
}
type Alias<T> = T;
class Store<T> {
  method<U>(value: U): U {
    return value;
  }
}
function declared<T>(value: T): T {
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
