// Ambient type declarations for React and JSX
// Resolves React and JSX diagnostics in environments without node_modules

declare namespace React {
  export type ReactNode =
    | ReactElement
    | string
    | number
    | boolean
    | null
    | undefined
    | Iterable<ReactNode>;

  export type Key = string | number;

  export interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
    type: T;
    props: P;
    key: Key | null;
  }

  export type JSXElementConstructor<P> =
    | ((props: P) => ReactElement<any, any> | null)
    | (new (props: P) => any);

  export type PropsWithChildren<P = unknown> = P & { children?: ReactNode | undefined };

  export interface FunctionComponent<P = {}> {
    (props: PropsWithChildren<P>, context?: any): ReactElement<any, any> | null;
    propTypes?: any;
    contextTypes?: any;
    defaultProps?: Partial<P>;
    displayName?: string;
  }

  export type FC<P = {}> = FunctionComponent<P>;

  export type CSSProperties = {
    [key: string]: string | number | undefined;
  };

  export interface SyntheticEvent<E = Event, T = any> {
    nativeEvent: E;
    currentTarget: T;
    target: T;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    eventPhase: number;
    isTrusted: boolean;
    preventDefault(): void;
    stopPropagation(): void;
    persist(): void;
    timeStamp: number;
    type: string;
  }

  export interface FormEvent<T = Element> extends SyntheticEvent<Event, T> {}
  export interface ChangeEvent<T = Element> extends SyntheticEvent<Event, T> {}
  export interface MouseEvent<T = Element> extends SyntheticEvent<globalThis.MouseEvent, T> {}
  export interface KeyboardEvent<T = Element> extends SyntheticEvent<globalThis.KeyboardEvent, T> {}

  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prevState: S) => S);

  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];

  export type EffectCallback = () => void | Destructor;
  export type Destructor = () => void;
  export type DependencyList = ReadonlyArray<any>;

  export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: DependencyList): T;
  export function useMemo<T>(factory: () => T, deps: DependencyList | undefined): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function useRef<T = undefined>(): { current: T | undefined };
  export function useContext<T>(context: any): T;

  export const Fragment: any;
  export function createElement(type: any, props?: any, ...children: any[]): ReactElement;

  const ReactDefault: {
    useState: typeof useState;
    useEffect: typeof useEffect;
    useCallback: typeof useCallback;
    useMemo: typeof useMemo;
    useRef: typeof useRef;
    useContext: typeof useContext;
    createElement: typeof createElement;
    Fragment: typeof Fragment;
    FC: typeof FunctionComponent;
  };

  export default ReactDefault;
}

declare module 'react' {
  export = React;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'react-dom' {
  export function render(element: any, container: any, callback?: () => void): any;
  export function createPortal(children: React.ReactNode, container: Element, key?: null | string): React.ReactElement;
}

declare module 'react-dom/client' {
  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass {
      render(): React.ReactNode;
    }
    interface ElementAttributesProperty {
      props: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }
    interface IntrinsicAttributes {
      key?: React.Key | null;
      children?: React.ReactNode;
    }
    interface IntrinsicClassAttributes<T> {
      ref?: any;
    }
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};
