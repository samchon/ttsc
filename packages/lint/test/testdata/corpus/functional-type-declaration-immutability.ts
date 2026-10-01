// expect: functional/type-declaration-immutability error
interface State {
  values: string[];
}

declare const state: State;
JSON.stringify(state);
