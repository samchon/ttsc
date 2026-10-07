// expect: functional/readonly-type error
type Values = ReadonlyArray<string>;

declare const values: Values;
JSON.stringify(values);
