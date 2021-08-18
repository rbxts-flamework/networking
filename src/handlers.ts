import Signal from "@rbxts/signal";
import { NetworkInfo } from "./types";

type SignalCallback<T> = T extends Signal<infer C> ? C : never;

type NetworkEvents = typeof NetworkEvents;
const NetworkEvents = {
	onGuardFailed: new Signal<(player: Player, event: NetworkInfo, failedArg: number) => void>(),
} as const;

export function registerNetworkHandler<T extends keyof NetworkEvents>(
	event: T,
	callback: SignalCallback<NetworkEvents[T]>,
) {
	return NetworkEvents[event].Connect(callback);
}
