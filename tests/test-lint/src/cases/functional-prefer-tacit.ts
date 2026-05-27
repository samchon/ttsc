type Mapper = (value: number) => number;
declare function transform(value: number): number;

// expect: functional/prefer-tacit error
const map: Mapper = (value) => transform(value);

JSON.stringify(map);
