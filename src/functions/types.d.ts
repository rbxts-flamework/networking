import { t } from "@rbxts/t";
import { NetworkingFunctionError } from "../functions/errors";
import { FunctionParameters, FunctionReturn, NetworkingObfuscationMarker, StripTSDoc } from "../types";

export interface ServerSender<I extends unknown[], O> {
	(player: Player, ...args: I): Promise<O>;

	/**
	 * Sends this request to the specified player.
	 * @param player The player that will receive this event
	 */
	invoke(player: Player, ...args: I): Promise<O>;

	/**
	 * Sends this request to the specified player, specifying a timeout.
	 * @param player The player that will receive this event
	 * @param timeout The maximum time to wait before timing out
	 */
	invokeWithTimeout(player: Player, timeout: number, ...args: I): Promise<O>;
}

export interface ServerReceiver<I extends unknown[], O> {
	/**
	 * Connect to a networking event.
	 * @param event The event to connect to
	 * @param callback The callback that will be invoked
	 * @param guards A list of guards that will only be used on this connection
	 */
	setCallback(callback: (player: Player, ...args: I) => O | Promise<O>): void;

	/**
	 * Invokes a server function using player as the sender.
	 */
	predict(player: Player, ...args: I): Promise<O>;
}

export interface ClientSender<I extends unknown[], O> {
	(...args: I): Promise<O>;

	/**
	 * Sends this request to the server.
	 */
	invoke(...args: I): Promise<O>;

	/**
	 * Sends this request to the server, specifying a timeout.
	 * @param timeout The maximum time to wait before timing out
	 */
	invokeWithTimeout(timeout: number, ...args: I): Promise<O>;
}

export interface ClientReceiver<I extends unknown[], O> {
	/**
	 * Connect to a networking function.
	 * @param event The function to connect to
	 * @param callback The callback that will be invoked
	 */
	setCallback(callback: (...args: I) => O | Promise<O>): void;

	/**
	 * Invokes a client function.
	 */
	predict(...args: I): Promise<O>;
}

export type ServerHandler<E, R> = NetworkingObfuscationMarker &
	{ [k in keyof E]: ServerSender<FunctionParameters<E[k]>, FunctionReturn<E[k]>> } &
	{ [k in keyof StripTSDoc<R>]: ServerReceiver<FunctionParameters<R[k]>, FunctionReturn<R[k]>> };

export type ClientHandler<E, R> = NetworkingObfuscationMarker &
	{ [k in keyof E]: ClientSender<FunctionParameters<E[k]>, FunctionReturn<E[k]>> } &
	{ [k in keyof StripTSDoc<R>]: ClientReceiver<FunctionParameters<R[k]>, FunctionReturn<R[k]>> };

export interface GlobalFunction<S, C> {
	server: ServerHandler<C, S>;
	client: ClientHandler<S, C>;
}

export interface FunctionConfiguration {
	/**
	 * Disables input validation and return validation on the server, allowing any value to pass.
	 * Defaults to `false`
	 */
	disableServerGuards: boolean;

	/**
	 * Disables input validation and return validation on the client, allowing any value to pass.
	 * Defaults to `false`
	 */
	disableClientGuards: boolean;

	/**
	 * The default timeout for requests from the server to the client.
	 * Defaults to `10`
	 */
	defaultServerTimeout: number;

	/**
	 * The default timeout for requests from the client to the server.
	 * Defaults to `30`
	 */
	defaultClientTimeout: number;

	/**
	 * Emit a warning whenever a guard fails.
	 * Defaults to `RunService.IsStudio()`
	 */
	warnOnInvalidGuards: boolean;
}

export interface RequestInfo {
	nextId: number;
	requests: Map<number, (value: unknown, rejection?: NetworkingFunctionError) => void>;
}

export type ArbitaryGuards = {
	[key: string]: [parameters: [t.check<unknown>[], t.check<unknown> | undefined], result: t.check<unknown>];
};
