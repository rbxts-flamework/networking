import { Players } from "@rbxts/services";
import { fireNetworkHandler } from "handlers";
import { createMiddlewareProcessor } from "../middleware/createMiddlewareProcessor";
import { EventMiddlewareList, Middleware } from "../middleware/types";
import { NetworkInfo } from "../types";
import { ArbitaryGuards, ClientHandler, ClientReceiver, ClientSender } from "./types";

export function createClientHandler<S, C>(
	remotes: Map<string, RemoteEvent>,
	networkInfos: Map<string, NetworkInfo>,
	serverEvents: ArbitaryGuards,
	clientEvents: ArbitaryGuards,
	middlewareFactoryList?: EventMiddlewareList<C>,
): ClientHandler<S, C> {
	const handler = {} as ClientHandler<S, C>;
	const bindables = new Map<string, BindableEvent>();
	const processors = new Map<string, Middleware<unknown[], unknown>>();

	for (const [name] of pairs(clientEvents)) {
		const bindable = new Instance("BindableEvent");
		bindables.set(name as string, bindable);
	}

	for (const [name, remote] of remotes) {
		const networkInfo = networkInfos.get(name)!;
		const middlewareProcessor = createMiddlewareProcessor(
			middlewareFactoryList?.[name as never],
			networkInfo,
			(_, ...args) => bindables.get(name)?.Fire(...args),
		);

		processors.set(name, middlewareProcessor);
		remote.OnClientEvent.Connect((...args: unknown[]) => {
			const guards = clientEvents[name];
			if (!guards) return;

			for (let i = 0; i < guards.size(); i++) {
				const guard = guards[i];
				if (!guard(args[i])) {
					fireNetworkHandler("onBadRequest", Players.LocalPlayer, networkInfo, i);
					return;
				}
			}

			middlewareProcessor(undefined, ...args);
		});
	}

	for (const [name, remote] of remotes) {
		handler[name as keyof S] = createClientMethod(
			remote,
			clientEvents[remote.Name]?.size() ?? 0,
			bindables.get(remote.Name),
			processors.get(remote.Name),
		) as never;
	}

	return handler;
}

type ClientMethod = ClientSender<unknown[]> & ClientReceiver<unknown[]>;
function createClientMethod(
	remote: RemoteEvent,
	paramCount: number,
	bindable?: BindableEvent,
	process?: Middleware<unknown[], unknown>,
) {
	const method: { [k in keyof ClientMethod]: ClientMethod[k] } = {
		fire(...args) {
			remote.FireServer(...args);
		},

		connect(callback, customGuards) {
			assert(bindable, `Event ${remote.Name} is not registered as a receiver.`);

			return bindable.Event.Connect((...args: unknown[]) => {
				if (customGuards) {
					for (let i = 0; i < paramCount; i++) {
						const guard = customGuards[i];
						if (guard !== undefined && !guard(args[i])) {
							return;
						}
					}
				}
				return callback(...(args as never));
			});
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
