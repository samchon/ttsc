const o: any = {};
// expect: no-iterator error
JSON.stringify(o.__iterator__);
