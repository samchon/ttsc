export namespace Outer {
  export const version = 1;
  export const name = "outer";
  export namespace Inner {
    const secret = 42;
    export const exposed = secret;
    export function compute(): number {
      let acc = 0;
      acc += secret;
      return acc;
    }
  }
}
