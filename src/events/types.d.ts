import { t } from "@rbxts/t";
import { FunctionParameters } from "../types";

export interface ServerSender<I extends unknown[]> {
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

export interface ServerReceiver<I extends unknown[]> {
	/**
	 * Connect to this networking event.
	 * @param callback The callback that will be fired
	 * @param guards A list of guards that will only be used on this connection
	 */
	connect<F extends I>(
		cb: (player: Player, ...args: I) => void,
		guards?: { [k in keyof F]: t.check<F[k]> },
	): RBXScriptConnection;
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
	connect<F extends I>(cb: (...args: I) => void, guards?: { [k in keyof F]: t.check<F[k]> }): RBXScriptConnection;

	/**
	 * Fires this event locally.
	 */
	predict(...args: I): void;
}

export type ServerHandler<E, R> = { [k in keyof E]: ServerSender<FunctionParameters<E[k]>> } &
	{ [k in keyof StripTSDoc<R>]: ServerReceiver<FunctionParameters<R[k]>> };

export type ClientHandler<E, R> = { [k in keyof E]: ClientSender<FunctionParameters<E[k]>> } &
	{ [k in keyof StripTSDoc<R>]: ClientReceiver<FunctionParameters<R[k]>> };

export interface GlobalEvent<S, C> {
	server: ServerHandler<C, S>;
	client: ClientHandler<S, C>;
}

export type ArbitaryGuards = { [key: string]: t.check<unknown>[] };

/**
 * A very gross hack to get rid of doc comment duplication on events.
 */
type StripTSDoc<T, E extends string | number | symbol = keyof T> = { [k in E]: k extends keyof T ? T[k] : never };
