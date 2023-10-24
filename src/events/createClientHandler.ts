import { Players } from "@rbxts/services";
import { EventNetworkingEvents } from "../handlers";
import { createMiddlewareProcessor } from "../middleware/createMiddlewareProcessor";
import { Middleware } from "../middleware/types";
import { NetworkInfo } from "../types";
import { ArbitaryGuards, ClientHandler, ClientReceiver, ClientSender, EventCreateConfiguration } from "./types";
import { SignalContainer } from "../util/createSignalContainer";

export function createClientHandler<S, C>(
	remotes: Map<string, RemoteEvent>,
	networkInfos: Map<string, NetworkInfo>,
	eventGuards: ArbitaryGuards,
	config: EventCreateConfiguration<C>,
	signals: SignalContainer<EventNetworkingEvents>,
): ClientHandler<S, C> {
	const handler = {} as ClientHandler<S, C>;
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

		remote.OnClientEvent.Connect((...args: unknown[]) => {
			const guards = eventGuards[name];
			if (!guards) return;

			if (!config.disableIncomingGuards) {
				const paramGuards = guards[0];
				const restGuard = guards[1];

				for (let i = 0; i < math.max(paramGuards.size(), args.size()); i++) {
					const guard = paramGuards[i] ?? restGuard;
					if (guard && !guard(args[i])) {
						if (config.warnOnInvalidGuards) {
							warn(`Server sent invalid argument for event '${name}' (arg #${i}):`, args[i]);
						}
						signals.fire("onBadRequest", Players.LocalPlayer, {
							networkInfo,
							argIndex: i,
							argValue: args[i],
						});
						return;
					}
				}
			}

			middlewareProcessor(undefined, ...args);
		});
	};

	for (const [name, remote] of remotes) {
		const networkInfo = networkInfos.get(name)!;
		const middlewareProcessor = createMiddlewareProcessor(
			config.middleware?.[name as never],
			networkInfo,
			(_, ...args) => bindables.get(name)?.Fire(...args),
		);

		processors.set(name, middlewareProcessor);
		handler[name as keyof S] = createClientMethod(
			() => setupRemote(name),
			remote,
			bindables.get(name),
			middlewareProcessor,
		) as never;
	}

	return handler;
}

type ClientMethod = ClientSender<unknown[]> & ClientReceiver<unknown[]>;
function createClientMethod(
	connect: () => void,
	remote: RemoteEvent,
	bindable?: BindableEvent,
	process?: Middleware<unknown[], unknown>,
) {
	const method: { [k in keyof ClientMethod]: ClientMethod[k] } = {
		fire(...args) {
			remote.FireServer(...args);
		},

		connect(callback) {
			assert(bindable, `Event ${remote.Name} is not registered as a receiver.`);
			task.defer(connect);

			return bindable.Event.Connect(callback);
		},

		predict(...args) {
			assert(process, `Event ${remote.Name} does not have a middleware processor.`);

			process(undefined, ...args);
		},
	};

	setmetatable(method, {
		__call: (method, ...args) => {
			method.fire(...args);
		},
	});

	return method;
}
