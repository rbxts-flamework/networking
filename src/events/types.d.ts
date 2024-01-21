import {
	FunctionParameters,
	IntrinsicTupleGuards,
	IntrinsicObfuscate,
	NetworkingObfuscationMarker,
	NetworkUnreliable,
	ObfuscateNames,
} from "../types";
import { EventNetworkingEvents } from "../handlers";
import { EventMiddleware } from "../middleware/types";
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
	[k in keyof Events<E>]: ServerSender<FunctionParameters<E[k]>>;
} & { [k in keyof Events<R>]: ServerReceiver<FunctionParameters<R[k]>> } & {
	[k in keyof EventNamespaces<E>]: ServerHandler<E[k], k extends keyof R ? R[k] : {}>;
} & {
	[k in keyof EventNamespaces<R>]: ServerHandler<k extends keyof E ? E[k] : {}, R[k]>;
};

export type ClientHandler<E, R> = NetworkingObfuscationMarker & {
	[k in keyof Events<E>]: ClientSender<FunctionParameters<E[k]>>;
} & { [k in keyof Events<R>]: ClientReceiver<FunctionParameters<R[k]>> } & {
	[k in keyof EventNamespaces<E>]: ClientHandler<E[k], k extends keyof R ? R[k] : {}>;
} & {
	[k in keyof EventNamespaces<R>]: ClientHandler<k extends keyof E ? E[k] : {}, R[k]>;
};

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
	createServer(config: Partial<EventCreateConfiguration<S>>, meta?: NamespaceMetadata<S, C>): ServerHandler<C, S>;

	/**
	 * This is the client implementation of the network and does not exist on the server.
	 *
	 * @metadata macro {@link config intrinsic-const} {@link config intrinsic-middleware}
	 */
	createClient(config: Partial<EventCreateConfiguration<C>>, meta?: NamespaceMetadata<C, S>): ClientHandler<S, C>;

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

export type EventNamespaces<T> = ExcludeMembers<T, Callback>;
export type Events<T> = ExtractMembers<T, Callback>;

export type NamespaceMetadata<R, S> = Modding.Many<{
	incomingIds: ObfuscateNames<keyof Events<R>>;
	incoming: IntrinsicObfuscate<{ [k in keyof Events<R>]: IntrinsicTupleGuards<Parameters<Events<R>[k]>> }>;
	incomingUnreliable: IntrinsicObfuscate<{
		[k in keyof Events<R>]: R[k] extends NetworkUnreliable<unknown> ? true : undefined;
	}>;

	outgoingIds: ObfuscateNames<keyof Events<S>>;
	outgoingUnreliable: IntrinsicObfuscate<{
		[k in keyof Events<S>]: S[k] extends NetworkUnreliable<unknown> ? true : undefined;
	}>;

	namespaceIds: ObfuscateNames<keyof EventNamespaces<R> | keyof EventNamespaces<S>>;
	namespaces: IntrinsicObfuscate<
		{
			[k in keyof EventNamespaces<R>]: NamespaceMetadata<R[k], k extends keyof S ? S[k] : {}>;
		} & {
			[k in keyof EventNamespaces<S>]: NamespaceMetadata<k extends keyof R ? R[k] : {}, S[k]>;
		}
	>;
}>;

export type EventMiddlewareList<T> = {
	readonly [k in keyof Events<T>]?: T[k] extends (...args: infer I) => void ? [...EventMiddleware<I>[]] : never;
} & {
	readonly [k in keyof EventNamespaces<T>]?: EventMiddlewareList<T[k]>;
};
