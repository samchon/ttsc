declare function require(name: string): any;
export const value: string = "dep+" + require("./leaf").leaf;
