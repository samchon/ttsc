const o: any = {};
// expect: noProto error
JSON.stringify(o.__proto__);
