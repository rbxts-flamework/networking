import { t } from "@rbxts/t";
import { NetworkingFunctionError } from "functions/errors";
import { FunctionParameters, FunctionReturn } from "../types";

export interface ServerMethod<I extends unknown[], O> {
	(player: Player, ...args: I): Promise<O>;

	/**
	 * Sends this request to the specified player(s).
	 * @param player The player that will receive this event
	 */
	invoke(player: Player, ...args: I): Promise<O>;
}

export interface ClientMethod<I extends unknown[], O> {
	(...args: I): Promise<O>;

	/**
	 * Sends this request to the server.
	 */
	invoke(...args: I): Promise<O>;
}

export type ServerFunctionList<T> = { [k in keyof T]: ServerMethod<FunctionParameters<T[k]>, FunctionReturn<T[k]>> };
export type ServerHandler<E, R> = ServerInterface<R> & ServerFunctionList<E>;
export interface ServerInterface<T> {
	/**
	 * Connect to a networking event.
	 * @param event The event to connect to
	 * @param callback The callback that will be invoked
	 * @param guards A list of guards that will only be used on this connection
	 */
	setCallback<E extends keyof T>(
		event: E,
		callback: (player: Player, ...args: FunctionParameters<T[E]>) => FunctionReturn<T[E]>,
	): void;
}

export type ClientFunctionList<T> = { [k in keyof T]: ClientMethod<FunctionParameters<T[k]>, FunctionReturn<T[k]>> };
export type ClientHandler<E, R> = ClientInterface<R> & ClientFunctionList<E>;
export interface ClientInterface<T> {
	/**
	 * Connect to a networking function.
	 * @param event The function to connect to
	 * @param callback The callback that will be invoked
	 */
	setCallback<E extends keyof T>(event: E, callback: T[E]): void;

	/**
	 * Invokes a client function.
	 * @param event The function to fire
	 */
	predict<E extends keyof T>(event: E, ...args: FunctionParameters<T[E]>): Promise<FunctionReturn<T[E]>>;
}

export interface GlobalFunction<S, C> {
	server: ServerHandler<C, S>;
	client: ClientHandler<S, C>;
}

export interface RequestInfo {
	nextId: number;
	requests: Map<number, (value: unknown, rejection?: NetworkingFunctionError) => void>;
}

export type ArbitaryGuards = { [key: string]: [parameters: t.check<unknown>[], result: t.check<unknown>] };
