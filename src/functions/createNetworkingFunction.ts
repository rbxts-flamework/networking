import { RunService } from "@rbxts/services";
import { ClientHandler, FunctionCreateConfiguration, GlobalFunction, ServerHandler } from "./types";
import { createSignalContainer } from "../util/createSignalContainer";
import { FunctionNetworkingEvents } from "../handlers";
import { createGenericHandler } from "./createGenericHandler";
import { createServerMethod } from "./createServerMethod";
import { createClientMethod } from "./createClientMethod";

const SERVER_PREFIX = "$";
const CLIENT_PREFIX = "@";

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
	serverNames: string[],
	clientNames: string[],
): GlobalFunction<S, C> {
	const signals = createSignalContainer<FunctionNetworkingEvents>();

	let server: ServerHandler<C, S> | undefined;
	let client: ClientHandler<S, C> | undefined;

	return {
		createServer(config, meta) {
			if (RunService.IsRunning() && !RunService.IsServer()) {
				return undefined!;
			}

			if (server === undefined) {
				server = createGenericHandler<ServerHandler<C, S>, C, S>(
					globalName,
					serverNames,
					clientNames,
					SERVER_PREFIX,
					CLIENT_PREFIX,
					meta!,
					getDefaultConfiguration(config),
					signals,
					createServerMethod,
				);
			}

			return server;
		},

		createClient(config, meta) {
			if (RunService.IsRunning() && !RunService.IsClient()) {
				return undefined!;
			}

			if (client === undefined) {
				client = createGenericHandler<ClientHandler<S, C>, S, C>(
					globalName,
					clientNames,
					serverNames,
					CLIENT_PREFIX,
					SERVER_PREFIX,
					meta!,
					getDefaultConfiguration(config),
					signals,
					createClientMethod,
				);
			}

			return client;
		},

		registerHandler(key, callback) {
			return signals.connect(key, callback);
		},
	};
}
