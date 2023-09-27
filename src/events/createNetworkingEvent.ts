import Object from "@rbxts/object-utils";
import { RunService } from "@rbxts/services";
import { EventMiddlewareList } from "../middleware/types";
import { NetworkInfo } from "../types";
import { populateInstanceMap } from "../util/populateInstanceMap";
import { createClientHandler } from "./createClientHandler";
import { createServerHandler } from "./createServerHandler";
import { ArbitaryGuards, EventConfiguration, GlobalEvent } from "./types";
import { createSignalContainer } from "../util/createSignalContainer";
import { EventNetworkingEvents } from "../handlers";

function getDefaultConfiguration(config: Partial<EventConfiguration>) {
	return identity<EventConfiguration>({
		disableClientGuards: config.disableClientGuards ?? false,
		disableServerGuards: config.disableServerGuards ?? false,
		warnOnInvalidGuards: config.warnOnInvalidGuards ?? RunService.IsStudio(),
	});
}

export function createNetworkingEvent<S, C>(
	globalName: string,
	serverEvents: ArbitaryGuards,
	clientEvents: ArbitaryGuards,
	serverMiddleware?: EventMiddlewareList<S>,
	clientMiddleware?: EventMiddlewareList<C>,
	partialConfig: Partial<EventConfiguration> = {},
): GlobalEvent<S, C> {
	const config = getDefaultConfiguration(partialConfig);
	const networkInfos = new Map<string, NetworkInfo>();
	const remotes = new Map<string, RemoteEvent>();
	const signals = createSignalContainer<EventNetworkingEvents>();

	populateInstanceMap("RemoteEvent", `events-${globalName}`, Object.keys(serverEvents) as string[], remotes);
	populateInstanceMap("RemoteEvent", `events-${globalName}`, Object.keys(clientEvents) as string[], remotes);

	for (const [name] of remotes) {
		networkInfos.set(name, {
			eventType: "Event",
			globalName,
			name,
		});
	}

	if (RunService.IsServer()) {
		return {
			server: createServerHandler(
				remotes,
				networkInfos,
				serverEvents,
				clientEvents,
				config,
				signals,
				serverMiddleware,
			),
			client: undefined!,
			registerHandler(key, callback) {
				return signals.connect(key, callback);
			},
		};
	} else {
		return {
			server: undefined!,
			client: createClientHandler(
				remotes,
				networkInfos,
				serverEvents,
				clientEvents,
				config,
				signals,
				clientMiddleware,
			),
			registerHandler(key, callback) {
				return signals.connect(key, callback);
			},
		};
	}
}
