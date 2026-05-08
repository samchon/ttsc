// expect: no-unsafe-function-type error
type Callback = Function;

JSON.stringify({} as Callback);
