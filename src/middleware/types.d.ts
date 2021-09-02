import { NetworkInfo } from "../types";
import { Skip } from "./skip";

export type Middleware<I extends readonly unknown[] = unknown[], O = void> = (player?: Player, ...args: I) => O;
export type MiddlewareFactory<I extends readonly unknown[] = [], O = void> = (
	processNext: Middleware<I, O>,
	event: NetworkInfo,
) => Middleware<I, O>;

export type EventMiddleware<I extends readonly unknown[] = unknown[]> = MiddlewareFactory<I, void>;
export type FunctionMiddleware<I extends readonly unknown[] = unknown[], O = void> = MiddlewareFactory<I, O | Skip>;

export type EventMiddlewareList<T> = {
	readonly [k in keyof T]?: T[k] extends (...args: infer I) => void ? [...EventMiddleware<I>[]] : never;
};

export type FunctionMiddlewareList<T> = {
	readonly [k in keyof T]?: T[k] extends (...args: infer I) => infer O ? [...FunctionMiddleware<I, O>[]] : never;
};
