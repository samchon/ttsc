declare function transform(value: number): number;

// expect: functional/prefer-tacit error
const map = (value: number) => transform(value);

JSON.stringify(map);
