import { GlobalEvent } from "./events/types";
import { GlobalFunction } from "./functions/types";
import { Skip as NetworkingSkip } from "./middleware/skip";
import { registerNetworkHandler as registerHandler } from "./handlers";
import { NetworkingFunctionError } from "./functions/errors";
import {
	EventMiddlewareList,
	FunctionMiddlewareList,
	MiddlewareFactory as _MiddlewareFactory,
	EventMiddleware as _EventMiddleware,
	FunctionMiddleware as _FunctionMiddleware,
} from "./middleware/types";

export namespace Networking {
	/**
	 * Creates a new event based off the supplied types.
	 * @param serverMiddleware Middleware for server events
	 * @param clientMiddleware Middleware for client events
	 */
	export declare function createEvent<S, C>(
		serverMiddleware?: EventMiddlewareList<S>,
		clientMiddleware?: EventMiddlewareList<C>,
	): GlobalEvent<S, C>;

	/**
	 * Creates a new function event based off the supplied types.
	 * @param serverMiddleware Middleware for server events
	 * @param clientMiddleware Middleware for client events
	 */
	export declare function createFunction<S, C>(
		serverMiddleware?: FunctionMiddlewareList<S>,
		clientMiddleware?: FunctionMiddlewareList<C>,
	): GlobalFunction<S, C>;

	/**
	 * Connects to a global network event.
	 */
	export const registerNetworkHandler = registerHandler;

	/**
	 * Stops networking function middleware.
	 */
	export const Skip = NetworkingSkip;

	/**
	 * A function that generates middleware.
	 * @hidden
	 * @deprecated Use {@link EventMiddleware} or {@link FunctionMiddleware}
	 */
	export type MiddlewareFactory<I extends readonly unknown[] = unknown[], O = void> = _MiddlewareFactory<I, O>;

	/**
	 * A function that generates an event middleware.
	 */
	export type EventMiddleware<I extends readonly unknown[] = unknown[]> = _EventMiddleware<I>;

	/**
	 * A function that generates an event middleware.
	 */
	export type FunctionMiddleware<I extends readonly unknown[] = unknown[], O = void> = _FunctionMiddleware<I, O>;
}

export { NetworkingFunctionError };
