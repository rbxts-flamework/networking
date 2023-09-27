import Signal from "@rbxts/signal";
import { NetworkInfo } from "./types";

type SignalCallback<T> = T extends Signal<infer C> ? C : never;

interface BaseEvent {
	/**
	 * The event or function that was fired.
	 */
	event: NetworkInfo;
}

interface BadRequestData extends BaseEvent {
	/**
	 * The index of the argument that was incorrect.
	 */
	argIndex: number;

	/**
	 * The value of the argument that was incorrect.
	 */
	argValue: unknown;
}

interface BadResponseData extends BaseEvent {
	/**
	 * The index of the argument that was incorrect.
	 */
	value: unknown;
}

export interface EventNetworkingEvents {
	onBadRequest: (player: Player, data: BadRequestData) => void;
}

export interface FunctionNetworkingEvents extends EventNetworkingEvents {
	onBadResponse: (player: Player, data: BadResponseData) => void;
}
