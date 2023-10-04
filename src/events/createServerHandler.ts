import { Players } from "@rbxts/services";
import { EventNetworkingEvents } from "../handlers";
import { createMiddlewareProcessor } from "../middleware/createMiddlewareProcessor";
import { Middleware } from "../middleware/types";
import { NetworkInfo } from "../types";
import { ArbitaryGuards, EventCreateConfiguration, ServerHandler, ServerReceiver, ServerSender } from "./types";
import { SignalContainer } from "../util/createSignalContainer";

export function createServerHandler<S, C>(
	remotes: Map<string, RemoteEvent>,
	networkInfos: Map<string, NetworkInfo>,
	eventGuards: ArbitaryGuards,
	config: EventCreateConfiguration<S>,
	signals: SignalContainer<EventNetworkingEvents>,
): ServerHandler<C, S> {
	const handler = {} as ServerHandler<C, S>;
	const bindables = new Map<string, BindableEvent>();
	const processors = new Map<string, Middleware<unknown[], unknown>>();
	const isSetup = new Set<string>();

	for (const [name] of pairs(eventGuards)) {
		const bindable = new Instance("BindableEvent");
		bindables.set(name as string, bindable);
	}

	const setupRemote = (name: string) => {
		if (isSetup.has(name)) return;
		isSetup.add(name);

		const remote = remotes.get(name)!;
		const networkInfo = networkInfos.get(name)!;
		const middlewareProcessor = processors.get(name)!;

		remote.OnServerEvent.Connect((player, ...args) => {
			const guards = eventGuards[name];
			if (!guards) return;

			if (!config.disableIncomingGuards) {
				const paramGuards = guards[0];
				const restGuard = guards[1];

				for (let i = 0; i < math.max(paramGuards.size(), args.size()); i++) {
					const guard = paramGuards[i] ?? restGuard;
					if (guard && !guard(args[i])) {
						if (config.warnOnInvalidGuards) {
							warn(`'${player}' sent invalid arguments for event '${name}' (arg #${i}):`, args[i]);
						}
						signals.fire("onBadRequest", player, {
							networkInfo,
							argIndex: i,
							argValue: args[i],
						});
						return;
					}
				}
			}

			middlewareProcessor(player, ...args);
		});
	};

	for (const [name, remote] of remotes) {
		const networkInfo = networkInfos.get(name)!;
		const middlewareProcessor = createMiddlewareProcessor(
			config.middleware?.[name as never],
			networkInfo,
			(player, ...args) => bindables.get(name)?.Fire(player, ...args),
		);

		processors.set(name, middlewareProcessor);
		handler[name as keyof C] = createServerMethod(
			() => setupRemote(name),
			remote,
			eventGuards[name]?.size() ?? 0,
			bindables.get(name),
			middlewareProcessor,
		) as never;
	}

	return handler;
}

type ServerMethod = ServerSender<unknown[]> & ServerReceiver<unknown[]>;
function createServerMethod(
	connect: () => void,
	remote: RemoteEvent,
	paramCount: number,
	bindable?: BindableEvent,
	process?: Middleware<unknown[], unknown>,
) {
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
			task.defer(connect);

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

		predict(player, ...args) {
			assert(process, `Event ${remote.Name} does not have a middleware processor.`);

			process(player, ...args);
		},
	};

	setmetatable(method, {
		__call: (method, player, ...args) => {
			method.fire(player as Player, ...args);
		},
	});

	return method;
}
