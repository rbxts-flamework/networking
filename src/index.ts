import { GlobalEvent } from "./events/types";
import { GlobalFunction } from "./functions/types";
import { Skip as NetworkingSkip } from "./middleware/skip";
import { NetworkingFunctionError } from "./function/errors";
import {
	MiddlewareFactory as _MiddlewareFactory,
	EventMiddleware as _EventMiddleware,
	FunctionMiddleware as _FunctionMiddleware,
} from "./middleware/types";
import { createNetworkingEvent } from "./events/createNetworkingEvent";
import { createNetworkingFunction } from "./functions/createNetworkingFunction";
import { IntrinsicDeclaration, ObfuscateNames } from "./types";

export namespace Networking {
	/**
	 * Creates a new event based off the supplied types.
	 * @param serverMiddleware Middleware for server events
	 * @param clientMiddleware Middleware for client events
	 * @metadata macro
	 */
	export function createEvent<S, C>(
		name?: IntrinsicDeclaration,
		server?: ObfuscateNames<keyof S>,
		client?: ObfuscateNames<keyof C>,
	): GlobalEvent<S, C> {
		return createNetworkingEvent(name!, server!, client!);
	}

	/**
	 * Creates a new function event based off the supplied types.
	 * @param serverMiddleware Middleware for server events
	 * @param clientMiddleware Middleware for client events
	 * @metadata macro
	 */
	export function createFunction<S, C>(
		name?: IntrinsicDeclaration,
		server?: ObfuscateNames<keyof S>,
		client?: ObfuscateNames<keyof C>,
	): GlobalFunction<S, C> {
		return createNetworkingFunction(name!, server!, client!);
	}

	/**
	 * Stops networking function middleware.
	 */
	export const Skip = NetworkingSkip;

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
