import { Players } from "@rbxts/services";
import Signal from "@rbxts/signal";
import { NetworkInfo } from "./types";

type SignalCallback<T> = T extends Signal<infer C> ? C : never;

type NetworkEvents = typeof NetworkEvents;
const NetworkEvents = {
	onBadRequest: new Signal<(player: Player, event: NetworkInfo, failedArg: number) => void>(),
	onBadResponse: new Signal<(player: Player, event: NetworkInfo) => void>(),
} as const;

export function registerNetworkHandler<T extends keyof NetworkEvents>(
	event: T,
	callback: SignalCallback<NetworkEvents[T]>,
) {
	return NetworkEvents[event].Connect(callback as never);
}

export function fireNetworkHandler<T extends keyof NetworkEvents>(
	event: T,
	...args: Parameters<SignalCallback<NetworkEvents[T]>>
) {
	(NetworkEvents[event] as Signal<(...args: unknown[]) => void>).Fire(...args);
}
