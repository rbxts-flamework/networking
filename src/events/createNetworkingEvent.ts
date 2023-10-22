import Object from "@rbxts/object-utils";
import { RunService } from "@rbxts/services";
import { NetworkInfo } from "../types";
import { populateInstanceMap } from "../util/populateInstanceMap";
import { createClientHandler } from "./createClientHandler";
import { createServerHandler } from "./createServerHandler";
import { ArbitaryGuards, ClientHandler, EventCreateConfiguration, GlobalEvent, ServerHandler } from "./types";
import { createSignalContainer } from "../util/createSignalContainer";
import { EventNetworkingEvents } from "../handlers";

function getDefaultConfiguration<T>(config: Partial<EventCreateConfiguration<T>>) {
	return identity<EventCreateConfiguration<T>>({
		middleware: config.middleware ?? {},
		warnOnInvalidGuards: config.warnOnInvalidGuards ?? RunService.IsStudio(),
		disableIncomingGuards: config.disableIncomingGuards ?? false,
	});
}

export function createNetworkingEvent<S, C>(
	globalName: string,
	serverNames: string[],
	clientNames: string[],
): GlobalEvent<S, C> {
	const networkInfos = new Map<string, NetworkInfo>();
	const remotes = new Map<string, RemoteEvent>();
	const signals = createSignalContainer<EventNetworkingEvents>();

	const setupRemotes = () => {
		populateInstanceMap("RemoteEvent", `events-${globalName}`, serverNames, remotes);
		populateInstanceMap("RemoteEvent", `events-${globalName}`, clientNames, remotes);

		for (const [name] of remotes) {
			networkInfos.set(name, {
				eventType: "Event",
				globalName,
				name,
			});
		}
	};

	let server: ServerHandler<C, S> | undefined;
	let client: ClientHandler<S, C> | undefined;

	return {
		createServer(config, meta) {
			if (!RunService.IsServer()) {
				return undefined!;
			}

			setupRemotes();
			return (server ??= createServerHandler<S, C>(
				remotes,
				networkInfos,
				meta!,
				getDefaultConfiguration(config),
				signals,
			));
		},

		createClient(config, meta) {
			if (!RunService.IsClient()) {
				return undefined!;
			}

			setupRemotes();
			return (client ??= createClientHandler<S, C>(
				remotes,
				networkInfos,
				meta!,
				getDefaultConfiguration(config),
				signals,
			));
		},

		registerHandler(key, callback) {
			return signals.connect(key, callback);
		},
	};
}
