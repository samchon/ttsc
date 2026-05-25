// expect: consistent-indexed-object-style error
type Dict = { [key: string]: number };
const d: Dict = {};
JSON.stringify(d);
