import { GlobalEvent } from "./events/types";
import { GlobalFunction } from "./functions/types";
import { Skip as NetworkingSkip } from "middleware/skip";
import { registerNetworkHandler as registerHandler } from "./handlers";
import { EventMiddlewareList, FunctionMiddlewareList } from "./middleware/types";

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
}
