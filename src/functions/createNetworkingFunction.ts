import Object from "@rbxts/object-utils";
import { RunService } from "@rbxts/services";
import { FunctionMiddlewareList } from "../middleware/types";
import { NetworkInfo } from "../types";
import { populateInstanceMap } from "../util/populateInstanceMap";
import { createClientHandler } from "./createClientHandler";
import { createServerHandler } from "./createServerHandler";
import {
	ArbitaryGuards,
	ClientHandler,
	FunctionConfiguration,
	FunctionCreateConfiguration,
	GlobalFunction,
	ServerHandler,
} from "./types";
import { createSignalContainer } from "../util/createSignalContainer";
import { FunctionNetworkingEvents } from "../handlers";

function getDefaultConfiguration<T>(config: Partial<FunctionCreateConfiguration<T>>) {
	return identity<FunctionCreateConfiguration<T>>({
		middleware: config.middleware ?? {},
		defaultTimeout: config.defaultTimeout ?? (RunService.IsClient() ? 30 : 10),
		warnOnInvalidGuards: config.warnOnInvalidGuards ?? RunService.IsStudio(),
		disableIncomingGuards: config.disableIncomingGuards ?? false,
	});
}

export function createNetworkingFunction<S, C>(
	globalName: string,
	serverNamesPlain: string[],
	clientNamesPlain: string[],
): GlobalFunction<S, C> {
	const networkInfos = new Map<string, NetworkInfo>();
	const serverRemotes = new Map<string, RemoteEvent>();
	const clientRemotes = new Map<string, RemoteEvent>();
	const signals = createSignalContainer<FunctionNetworkingEvents>();

	const serverNames = serverNamesPlain.map((x) => `s:${x}`);
	const clientNames = clientNamesPlain.map((x) => `c:${x}`);

	const setupRemotes = () => {
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
				serverRemotes,
				clientRemotes,
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
				serverRemotes,
				clientRemotes,
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
