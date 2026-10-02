declare const process: {stdout: {write(text: string): void}};
process.stdout.write("child:rescued-from-source");
export {};
