// expect: functional/prefer-readonly-type error
type Values = string[];

declare const values: Values;
JSON.stringify(values);
