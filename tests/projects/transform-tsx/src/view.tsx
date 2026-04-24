declare function h(tag: string, props: null): string;
declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: {};
    }
  }
}
export const node = <div />;
