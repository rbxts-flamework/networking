import Signal from "@rbxts/signal";

export interface SignalContainer<T> {
	fire<K extends keyof T>(name: K, ...args: Parameters<T[K]>): void;
	connect<K extends keyof T>(name: K, callback: T[K]): RBXScriptConnection;
}

export function createSignalContainer<T>(): SignalContainer<T> {
	const signals = new Map<keyof T, Signal<Callback>>();

	return {
		fire(name, ...args) {
			const signal = signals.get(name);
			if (signal) {
				signal.Fire(...args);
			}
		},

		connect(name, callback) {
			let signal = signals.get(name);
			if (!signal) signals.set(name, (signal = new Signal()));

			return signal.Connect(callback as Callback);
		},
	};
}
