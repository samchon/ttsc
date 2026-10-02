declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    div: { children?: unknown };
  }
}

declare namespace React {
  function createElement(
    type: string,
    props: unknown,
    ...children: unknown[]
  ): JSX.Element;
}

declare module "react/jsx-runtime" {
  export namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      div: { children?: unknown };
    }
  }
  export function jsx(type: string, props: unknown): JSX.Element;
  export function jsxs(type: string, props: unknown): JSX.Element;
}

declare module "react/jsx-dev-runtime" {
  export namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      div: { children?: unknown };
    }
  }
  export function jsxDEV(
    type: string,
    props: unknown,
    key?: unknown,
    isStaticChildren?: boolean,
    source?: unknown,
    self?: unknown,
  ): JSX.Element;
}
