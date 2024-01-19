import { RunService } from "@rbxts/services";
import { MiddlewareFactory, MiddlewareProcessor } from "../middleware/types";
import { createRemoteInstance } from "./createRemoteInstance";
import { NetworkInfo } from "../types";
import { createMiddlewareProcessor } from "../middleware/createMiddlewareProcessor";

export interface CreateEventOptions {
	/**
	 * The namespace this event should be created in.
	 */
	namespace: string;

	/**
	 * The name of the remote instance, not necessarily unique and used for debugging purposes.
	 */
	debugName: string;

	/**
	 * The remote's ID which must be unique.
	 */
	id: string;

	/**
	 * Information about the network, which includes some of the above.
	 *
	 * Passed to the middleware.
	 */
	networkInfo: NetworkInfo;

	/**
	 * The reliability of this remote.
	 *
	 * Defaults to reliable.
	 */
	reliability?: "reliable" | "unreliable";

	/**
	 * A list of middleware that this event uses when it receives an event.
	 */
	incomingMiddleware?: MiddlewareFactory<any[], void>[];
}

export interface EventInterface {
	fireEither(player: Player | undefined, ...args: unknown[]): void;
	fireServer(...args: unknown[]): void;
	fireClient(player: Player, ...args: unknown[]): void;
	fireAllClients(...args: unknown[]): void;
	connectServer(callback: (player: Player, ...args: unknown[]) => void): RBXScriptConnection;
	connectClient(callback: (...args: unknown[]) => void): RBXScriptConnection;
	invoke: MiddlewareProcessor<any[], void>;
}

export function createEvent(options: CreateEventOptions): EventInterface {
	const remote = createRemoteInstance(
		options.reliability === "unreliable" ? "UnreliableRemoteEvent" : "RemoteEvent",
		options.namespace,
		options.debugName,
		options.id,
	) as RemoteEvent;

	let bindable: BindableEvent | undefined;

	const invoke = createMiddlewareProcessor(options.incomingMiddleware, options.networkInfo, (player, ...args) => {
		if (RunService.IsServer()) {
			bindable!.Fire(player as never, ...(args as never[]));
		} else {
			bindable!.Fire(...(args as never[]));
		}
	});

	const createConnection = (callback: (...args: never[]) => void) => {
		if (bindable) {
			return bindable.Event.Connect(callback);
		}

		bindable = new Instance("BindableEvent");

		// We defer to allow any other immediate connections to take place before unloading Roblox's queue.
		task.defer(() => {
			if (RunService.IsServer()) {
				remote.OnServerEvent.Connect((player, ...args) => {
					invoke(player, ...args);
				});
			} else {
				remote.OnClientEvent.Connect((...args: unknown[]) => {
					invoke(undefined, ...args);
				});
			}
		});

		return bindable.Event.Connect(callback);
	};

	return {
		fireEither(player, ...args) {
			if (player) {
				this.fireClient(player, ...args);
			} else {
				this.fireServer(...args);
			}
		},

		fireServer(...args) {
			remote.FireServer(...args);
		},

		fireClient(player, ...args) {
			remote.FireClient(player, ...args);
		},

		fireAllClients(...args) {
			remote.FireAllClients(...args);
		},

		connectServer(callback) {
			assert(RunService.IsServer());

			return createConnection(callback);
		},

		connectClient(callback) {
			assert(RunService.IsClient());

			return createConnection(callback);
		},

		invoke,
	};
}
