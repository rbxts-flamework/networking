import { Players } from "@rbxts/services";
import { fireNetworkHandler } from "handlers";
import { createMiddlewareProcessor } from "../middleware/createMiddlewareProcessor";
import { EventMiddlewareList } from "../middleware/types";
import { NetworkInfo } from "../types";
import { ArbitaryGuards, ServerHandler, ServerReceiver, ServerSender } from "./types";

export function createServerHandler<S, C>(
	remotes: Map<string, RemoteEvent>,
	networkInfos: Map<string, NetworkInfo>,
	serverEvents: ArbitaryGuards,
	clientEvents: ArbitaryGuards,
	middlewareFactoryList?: EventMiddlewareList<S>,
): ServerHandler<C, S> {
	const handler = {} as ServerHandler<C, S>;
	const bindables = new Map<string, BindableEvent>();

	for (const [name] of pairs(serverEvents)) {
		const bindable = new Instance("BindableEvent");
		bindables.set(name as string, bindable);
	}

	for (const [name, remote] of remotes) {
		const networkInfo = networkInfos.get(name)!;
		const middlewareProcessor = createMiddlewareProcessor(
			middlewareFactoryList?.[name as never],
			networkInfo,
			(player, ...args) => bindables.get(name)?.Fire(player, ...args),
		);

		remote.OnServerEvent.Connect((player, ...args) => {
			const guards = serverEvents[name];
			if (!guards) return;

			for (let i = 0; i < guards.size(); i++) {
				const guard = guards[i];
				if (!guard(args[i])) {
					fireNetworkHandler("onBadRequest", player, networkInfo, i);
					return;
				}
			}

			middlewareProcessor(player, ...args);
		});
	}

	for (const [name, remote] of remotes) {
		handler[name as keyof C] = createServerMethod(
			remote,
			serverEvents[name]?.size() ?? 0,
			bindables.get(name as string),
		) as never;
	}

	return handler;
}

type ServerMethod = ServerSender<unknown[]> & ServerReceiver<unknown[]>;
function createServerMethod(remote: RemoteEvent, paramCount: number, bindable?: BindableEvent) {
	const method: { [k in keyof ServerMethod]: ServerMethod[k] } = {
		fire(players, ...args) {
			if (typeIs(players, "Instance")) {
				remote.FireClient(players, ...args);
			} else {
				for (const player of players) {
					remote.FireClient(player, ...args);
				}
			}
		},

		broadcast(...args) {
			remote.FireAllClients(...args);
		},

		except(players, ...args) {
			if (typeIs(players, "Instance")) players = [players];

			for (const player of Players.GetPlayers()) {
				if (!players.includes(player)) {
					this.fire(player, ...args);
				}
			}
		},

		connect(callback, customGuards) {
			assert(bindable, `Event ${remote.Name} is not registered as a receiver.`);

			return bindable.Event.Connect((player: Player, ...args: unknown[]) => {
				if (customGuards) {
					for (let i = 0; i < paramCount; i++) {
						const guard = customGuards[i];
						if (guard !== undefined && !guard(args[i])) {
							return;
						}
					}
				}
				return callback(player, ...(args as never));
			});
		},
	};

	setmetatable(method, {
		__call: (method, player, ...args) => {
			method.fire(player as Player, ...args);
		},
	});

	return method;
}
