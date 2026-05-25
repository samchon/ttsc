// expect: consistentIndexedObjectStyle error
type Dict = { [key: string]: number };
const d: Dict = {};
JSON.stringify(d);
