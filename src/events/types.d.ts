import { t } from "@rbxts/t";
import {
	FunctionParameters,
	IntrinsicTupleGuards,
	IntrinsicObfuscate,
	NetworkingObfuscationMarker,
	StripTSDoc,
	NetworkUnreliable,
} from "../types";
import { EventNetworkingEvents } from "../handlers";
import { EventMiddlewareList } from "../middleware/types";
import { Modding } from "@flamework/core";

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
	 */
	connect(cb: (player: Player, ...args: I) => void): RBXScriptConnection;

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
	 */
	connect(cb: (...args: I) => void): RBXScriptConnection;

	/**
	 * Fires a client event.
	 */
	predict(...args: I): void;
}

export type ServerHandler<E, R> = NetworkingObfuscationMarker & {
	[k in keyof E]: ServerSender<FunctionParameters<E[k]>>;
} & { [k in keyof StripTSDoc<R>]: ServerReceiver<FunctionParameters<R[k]>> };

export type ClientHandler<E, R> = NetworkingObfuscationMarker & {
	[k in keyof E]: ClientSender<FunctionParameters<E[k]>>;
} & { [k in keyof StripTSDoc<R>]: ClientReceiver<FunctionParameters<R[k]>> };

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
	 *
	 * @metadata macro {@link config intrinsic-const} {@link config intrinsic-middleware}
	 */
	createServer(config: Partial<EventCreateConfiguration<S>>, meta?: EventMetadata<S, C>): ServerHandler<C, S>;

	/**
	 * This is the client implementation of the network and does not exist on the server.
	 *
	 * @metadata macro {@link config intrinsic-const} {@link config intrinsic-middleware}
	 */
	createClient(config: Partial<EventCreateConfiguration<C>>, meta?: EventMetadata<C, S>): ClientHandler<S, C>;

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

export type EventMetadata<R, S> = Modding.Many<{
	incoming: IntrinsicObfuscate<{ [k in keyof R]: IntrinsicTupleGuards<Parameters<R[k]>> }>;
	incomingUnreliable: IntrinsicObfuscate<{
		[k in keyof R]: R[k] extends NetworkUnreliable<unknown> ? true : undefined;
	}>;
	outgoingUnreliable: IntrinsicObfuscate<{
		[k in keyof S]: S[k] extends NetworkUnreliable<unknown> ? true : undefined;
	}>;
}>;
