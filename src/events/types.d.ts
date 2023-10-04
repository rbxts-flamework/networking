import { t } from "@rbxts/t";
import { FunctionParameters, NetworkingObfuscationMarker, StripTSDoc } from "../types";
import { EventNetworkingEvents } from "../handlers";
import { EventMiddlewareList } from "../middleware/types";

export interface ServerSender<I extends unknown[]> {
	(player: Player | Player[], ...args: I): void;

	/**
	 * Sends this request to the specified player(s).
	 * @param players The player(s) that will receive this event
	 */
	fire(players: Player | Player[], ...args: I): void;

	/**
	 * Sends this request to all players, excluding the specified player(s).
	 * @param players The player(s) that will not receive this event
	 */
	except(players: Player | Player[], ...args: I): void;

	/**
	 * Sends this request to all connected players.
	 */
	broadcast(...args: I): void;
}

export interface ServerReceiver<I extends unknown[]> {
	/**
	 * Connect to this networking event.
	 * @param callback The callback that will be fired
	 * @param guards A list of guards that will only be used on this connection
	 */
	connect<F extends I>(
		cb: (player: Player, ...args: F) => void,
		guards?: { [k in keyof F]?: t.check<F[k]> },
	): RBXScriptConnection;

	/**
	 * Fires a server event using player as the sender.
	 */
	predict(player: Player, ...args: I): void;
}

export interface ClientSender<I extends unknown[]> {
	(...args: I): void;

	/**
	 * Sends this request to the server.
	 */
	fire(...args: I): void;
}

export interface ClientReceiver<I extends unknown[]> {
	/**
	 * Connect to this networking event.
	 * @param callback The callback that will be fired
	 * @param guards A list of guards that will only be used on this connection
	 */
	connect<F extends I>(cb: (...args: F) => void, guards?: { [k in keyof F]?: t.check<F[k]> }): RBXScriptConnection;

	/**
	 * Fires a client event.
	 */
	predict(...args: I): void;
}

export type ServerHandler<E, R> = NetworkingObfuscationMarker &
	{ [k in keyof E]: ServerSender<FunctionParameters<E[k]>> } &
	{ [k in keyof StripTSDoc<R>]: ServerReceiver<FunctionParameters<R[k]>> };

export type ClientHandler<E, R> = NetworkingObfuscationMarker &
	{ [k in keyof E]: ClientSender<FunctionParameters<E[k]>> } &
	{ [k in keyof StripTSDoc<R>]: ClientReceiver<FunctionParameters<R[k]>> };

export interface EventCreateConfiguration<T> {
	/**
	 * Disables input validation, allowing any value to pass.
	 * Defaults to `false`
	 */
	disableIncomingGuards: boolean;

	/**
	 * Emit a warning whenever a guard fails.
	 * Defaults to `RunService.IsStudio()`
	 */
	warnOnInvalidGuards: boolean;

	/**
	 * The middleware for each event.
	 */
	middleware: EventMiddlewareList<T>;
}

export interface GlobalEvent<S, C> {
	/**
	 * This is the server implementation of the network and does not exist on the client.
	 */
	createServer(config: Partial<EventCreateConfiguration<S>>): ServerHandler<C, S>;

	/**
	 * This is the client implementation of the network and does not exist on the server.
	 */
	createClient(config: Partial<EventCreateConfiguration<C>>): ClientHandler<S, C>;

	/**
	 * Registers a networking event handler.
	 * @param key The name of the event
	 * @param callback The handler you wish to attach
	 */
	registerHandler<K extends keyof EventNetworkingEvents>(
		key: K,
		callback: EventNetworkingEvents[K],
	): RBXScriptConnection;
}

export type ArbitaryGuards = { [key: string]: [t.check<unknown>[], t.check<unknown> | undefined] };
