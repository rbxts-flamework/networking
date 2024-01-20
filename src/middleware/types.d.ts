import { NetworkInfo } from "../types";
import { Skip } from "./skip";

export type MiddlewareProcessor<I extends readonly unknown[], O> = (player?: Player, ...args: I) => Promise<O>;
export type Middleware<I extends readonly unknown[] = unknown[], O = void> = (
	player?: Player,
	...args: I
) => O | Promise<O>;
export type MiddlewareFactory<I extends readonly unknown[] = [], O = void> = (
	processNext: MiddlewareProcessor<I, O>,
	event: NetworkInfo,
) => Middleware<I, O>;

export type EventMiddleware<I extends readonly unknown[] = unknown[]> = MiddlewareFactory<I, void>;
export type FunctionMiddleware<I extends readonly unknown[] = unknown[], O = void> = MiddlewareFactory<I, O | Skip>;
