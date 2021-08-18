import { Players } from "@rbxts/services";
import { t } from "@rbxts/t";
import { createMiddlewareProcessor } from "../middleware/createMiddlewareProcessor";
import { EventMiddleware, EventMiddlewareList } from "../middleware/types";
import { NetworkInfo } from "../types";
import { ArbitaryGuards, ServerHandler, ServerMethod } from "./types";

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

	for (const [name] of pairs(clientEvents)) {
		const remote = remotes.get(name as string)!;

		handler[name as keyof C] = createServerMethod(remote) as never;
	}

	for (const [name, remote] of remotes) {
		const middlewareProcessor = createMiddlewareProcessor(
			middlewareFactoryList?.[name as never],
			networkInfos.get(name)!,
			(player, ...args) => {
				bindables.get(name)?.Fire(player, ...args);
			},
		);

		remote.OnServerEvent.Connect((player, ...args) => {
			const guards = serverEvents[name];
			if (!guards) return;

			for (let i = 0; i < guards.size(); i++) {
				const guard = guards[i];
				if (!guard(args[i])) {
					return;
				}
			}

			middlewareProcessor(player, ...args);
		});
	}

	handler.connect = function (this: unknown, event, callback, customGuards) {
		const bindable = bindables.get(event as string);
		const guards = serverEvents[event as string];
		assert(bindable, `Could not find bindable for ${event}`);
		assert(guards, `Could not find guards for ${event}`);

		return bindable.Event.Connect((player: Player, ...args: unknown[]) => {
			if (customGuards) {
				for (let i = 0; i < guards.size(); i++) {
					const guard = customGuards[i + 1];
					if (guard !== undefined && !guard(args[i])) {
						return;
					}
				}
			}
			return callback(player, ...(args as never));
		});
	};

	return handler;
}

function createServerMethod(remote: RemoteEvent) {
	const method = {
		fire(players: Player | Player[], ...args: unknown[]) {
			if (typeIs(players, "Instance")) {
				remote.FireClient(players, ...args);
			} else {
				for (const player of players) {
					remote.FireClient(player, ...args);
				}
			}
		},

		broadcast(...args: unknown[]) {
			remote.FireAllClients(...args);
		},

		except(players: Player | Player[], ...args: unknown[]) {
			if (typeIs(players, "Instance")) players = [players];

			for (const player of Players.GetPlayers()) {
				if (!players.includes(player)) {
					this.fire(player);
				} else {
				}
			}
		},
	};

	setmetatable(method, {
		__call: (method, player, ...args) => {
			method.fire(player as Player, ...args);
		},
	});

	return method;
}
