import { RunService } from "@rbxts/services";
import { createClientMethod } from "./createClientMethod";
import { createServerMethod } from "./createServerMethod";
import { ClientHandler, EventCreateConfiguration, GlobalEvent, ServerHandler } from "./types";
import { createSignalContainer } from "../util/createSignalContainer";
import { EventNetworkingEvents } from "../handlers";
import { createGenericHandler } from "./createGenericHandler";

function getDefaultConfiguration<T>(config: Partial<EventCreateConfiguration<T>>) {
	return identity<EventCreateConfiguration<T>>({
		middleware: config.middleware ?? {},
		warnOnInvalidGuards: config.warnOnInvalidGuards ?? RunService.IsStudio(),
		disableIncomingGuards: config.disableIncomingGuards ?? false,
	});
}

export function createNetworkingEvent<S, C>(globalName: string): GlobalEvent<S, C> {
	const signals = createSignalContainer<EventNetworkingEvents>();

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
					undefined,
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
					undefined,
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
