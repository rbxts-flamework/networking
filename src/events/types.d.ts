import { t } from "@rbxts/t";
import { FunctionParameters, NetworkingObfuscationMarker, StripTSDoc } from "../types";

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

export interface GlobalEvent<S, C> {
	server: ServerHandler<C, S>;
	client: ClientHandler<S, C>;
}

export interface EventConfiguration {
	/**
	 * Disables input validation on the server, allowing any value to pass.
	 * Defaults to `false`
	 */
	disableServerGuards: boolean;

	/**
	 * Disables input validation on the client, allowing any value to pass.
	 * Defaults to `false`
	 */
	disableClientGuards: boolean;

	/**
	 * Emit a warning whenever a guard fails.
	 * Defaults to `RunService.IsStudio()`
	 */
	warnOnInvalidGuards: boolean;
}

export type ArbitaryGuards = { [key: string]: [t.check<unknown>[], t.check<unknown> | undefined] };
