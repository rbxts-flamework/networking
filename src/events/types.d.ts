import { t } from "@rbxts/t";
import { FunctionParameters } from "../types";

export interface ServerMethod<I extends unknown[]> {
	(player: Player | Player[], ...args: I): void;

	/**
	 * Sends this request to the specified player(s).
	 * @param players The player(s) that will receive this event
	 */
	fire(players: Player | Player[], ...args: I): void;

	/**
	 * Sends this request to all players, excluding the specified player(s).
	 * @param players The player(s) that will receive this event
	 */
	except(players: Player | Player[], ...args: I): void;

	/**
	 * Sends this request to all connected players.
	 */
	broadcast(...args: I): void;
}

export interface ClientMethod<I extends unknown[]> {
	(...args: I): void;

	/**
	 * Sends this request to the server.
	 */
	fire(...args: I): void;
}

export type ServerEventList<T> = { [k in keyof T]: ServerMethod<FunctionParameters<T[k]>> };
export type ServerHandler<E, R> = ServerInterface<R> & ServerEventList<E>;
export interface ServerInterface<T> {
	/**
	 * Connect to a networking event.
	 * @param event The event to connect to
	 * @param callback The callback that will be fired
	 * @param guards A list of guards that will only be used on this connection
	 */
	connect<E extends keyof T, F extends FunctionParameters<T[E]>>(
		event: E,
		callback: (player: Player, ...args: F) => void,
		guards?: { [k in keyof F]?: t.check<F[k]> },
	): RBXScriptConnection;
}

export type ClientEventList<T> = { [k in keyof T]: ClientMethod<FunctionParameters<T[k]>> };
export type ClientHandler<E, R> = ClientInterface<R> & ClientEventList<E>;
export interface ClientInterface<T> {
	/**
	 * Connect to a networking event.
	 * @param event The event to connect to
	 * @param callback The callback that will be fired
	 * @param guards A list of guards that will only be used on this connection
	 */
	connect<E extends keyof T, F extends FunctionParameters<T[E]>>(
		event: E,
		callback: (...args: F) => void,
		guards?: { [k in keyof F]?: t.check<F[k]> },
	): RBXScriptConnection;

	/**
	 * Fires a client event.
	 * @param event The event to fire
	 */
	predict<E extends keyof T>(event: E, ...args: FunctionParameters<T[E]>): void;
}

export interface GlobalEvent<S, C> {
	server: ServerHandler<C, S>;
	client: ClientHandler<S, C>;
}

export type ArbitaryGuards = { [key: string]: t.check<unknown>[] };
