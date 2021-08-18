import { createMiddlewareProcessor } from "../middleware/createMiddlewareProcessor";
import { EventMiddlewareList, Middleware } from "../middleware/types";
import { NetworkInfo } from "../types";
import { ArbitaryGuards, ClientHandler, ServerHandler } from "./types";

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

	for (const [name] of pairs(serverEvents)) {
		const remote = remotes.get(name as string)!;

		handler[name as keyof S] = createClientMethod(remote) as never;
	}

	for (const [name, remote] of remotes) {
		const middlewareFactories = middlewareFactoryList !== undefined && middlewareFactoryList[name as keyof C];
		const middlewareProcessor = createMiddlewareProcessor(
			middlewareFactories || [],
			networkInfos.get(name)!,
			(_, ...args) => {
				bindables.get(name)?.Fire(...args);
			},
		);

		processors.set(name, middlewareProcessor);
		remote.OnClientEvent.Connect((...args: unknown[]) => {
			const guards = clientEvents[name];
			if (!guards) return;

			for (let i = 0; i < guards.size(); i++) {
				const guard = guards[i];
				if (!guard(args[i])) {
					return;
				}
			}

			middlewareProcessor(undefined, ...args);
		});
	}

	handler.connect = function (this: unknown, event, callback, customGuards) {
		const bindable = bindables.get(event as string);
		const guards = clientEvents[event as string];
		assert(bindable, `Could not find bindable for ${event}`);
		assert(guards, `Could not find guards for ${event}`);

		return bindable.Event.Connect((...args: unknown[]) => {
			if (customGuards) {
				for (let i = 0; i < guards.size(); i++) {
					const guard = customGuards[i + 1];
					if (guard !== undefined && !guard(args[i])) {
						return;
					}
				}
			}
			return callback(...(args as never));
		});
	};

	handler.predict = function (this: unknown, event, ...args) {
		processors.get(event as string)?.(undefined, ...args);
	};

	return handler;
}

function createClientMethod(remote: RemoteEvent) {
	const method = {
		fire(...args: unknown[]) {
			remote.FireServer(...args);
		},
	};

	setmetatable(method, {
		__call: (method, ...args) => {
			method.fire(...args);
		},
	});

	return method;
}
