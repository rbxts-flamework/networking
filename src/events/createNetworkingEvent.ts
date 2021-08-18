import Object from "@rbxts/object-utils";
import { RunService } from "@rbxts/services";
import { EventMiddlewareList } from "../middleware/types";
import { NetworkInfo } from "../types";
import { populateInstanceMap } from "../util/populateInstanceMap";
import { createClientHandler } from "./createClientHandler";
import { createServerHandler } from "./createServerHandler";
import { ArbitaryGuards, GlobalEvent, ServerHandler } from "./types";

export function createNetworkingEvent<S, C>(
	globalName: string,
	serverEvents: ArbitaryGuards,
	clientEvents: ArbitaryGuards,
	serverMiddleware?: EventMiddlewareList<S>,
	clientMiddleware?: EventMiddlewareList<C>,
): GlobalEvent<S, C> {
	const networkInfos = new Map<string, NetworkInfo>();
	const remotes = new Map<string, RemoteEvent>();

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
			server: createServerHandler(remotes, networkInfos, serverEvents, clientEvents, serverMiddleware),
			client: undefined!,
		};
	} else {
		return {
			server: undefined!,
			client: createClientHandler(remotes, networkInfos, serverEvents, clientEvents, clientMiddleware),
		};
	}
}
