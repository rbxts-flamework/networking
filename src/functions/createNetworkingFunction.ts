import Object from "@rbxts/object-utils";
import { RunService } from "@rbxts/services";
import { FunctionMiddlewareList } from "../middleware/types";
import { NetworkInfo } from "../types";
import { populateInstanceMap } from "../util/populateInstanceMap";
import { createClientHandler } from "./createClientHandler";
import { createServerHandler } from "./createServerHandler";
import { ArbitaryGuards, GlobalFunction } from "./types";

export function createNetworkingFunction<S, C>(
	globalName: string,
	serverEvents: ArbitaryGuards,
	clientEvents: ArbitaryGuards,
	serverMiddleware?: FunctionMiddlewareList<S>,
	clientMiddleware?: FunctionMiddlewareList<C>,
): GlobalFunction<S, C> {
	const networkInfos = new Map<string, NetworkInfo>();
	const serverRemotes = new Map<string, RemoteEvent>();
	const clientRemotes = new Map<string, RemoteEvent>();

	const serverNames = Object.keys(serverEvents).map((x) => `s:${x}`);
	const clientNames = Object.keys(clientEvents).map((x) => `c:${x}`);

	populateInstanceMap("RemoteEvent", `functions-${globalName}`, serverNames, serverRemotes);
	populateInstanceMap("RemoteEvent", `functions-${globalName}`, clientNames, clientRemotes);

	for (const [alias] of serverRemotes) {
		const name = alias.sub(3);
		networkInfos.set(name, {
			eventType: "Function",
			globalName,
			name,
		});
	}

	for (const [alias] of clientRemotes) {
		const name = alias.sub(3);
		networkInfos.set(name, {
			eventType: "Function",
			globalName,
			name,
		});
	}

	if (RunService.IsServer()) {
		return {
			server: createServerHandler(
				serverRemotes,
				clientRemotes,
				networkInfos,
				serverEvents,
				clientEvents,
				serverMiddleware,
			),
			client: undefined!,
		};
	} else {
		return {
			server: undefined!,
			client: createClientHandler(
				serverRemotes,
				clientRemotes,
				networkInfos,
				serverEvents,
				clientEvents,
				clientMiddleware,
			),
		};
	}
}
