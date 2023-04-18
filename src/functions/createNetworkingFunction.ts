import Object from "@rbxts/object-utils";
import { RunService } from "@rbxts/services";
import { FunctionMiddlewareList } from "../middleware/types";
import { NetworkInfo } from "../types";
import { populateInstanceMap } from "../util/populateInstanceMap";
import { createClientHandler } from "./createClientHandler";
import { createServerHandler } from "./createServerHandler";
import { ArbitaryGuards, FunctionConfiguration, GlobalFunction } from "./types";

function getDefaultConfiguration(config: Partial<FunctionConfiguration>) {
	return identity<FunctionConfiguration>({
		disableClientGuards: config.disableClientGuards ?? false,
		disableServerGuards: config.disableServerGuards ?? false,
		defaultClientTimeout: config.defaultClientTimeout ?? 30,
		defaultServerTimeout: config.defaultServerTimeout ?? 10,
	});
}

export function createNetworkingFunction<S, C>(
	globalName: string,
	serverEvents: ArbitaryGuards,
	clientEvents: ArbitaryGuards,
	serverMiddleware?: FunctionMiddlewareList<S>,
	clientMiddleware?: FunctionMiddlewareList<C>,
	partialConfig: Partial<FunctionConfiguration> = {},
): GlobalFunction<S, C> {
	const config = getDefaultConfiguration(partialConfig);
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
				config,
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
				config,
				clientMiddleware,
			),
		};
	}
}
