export {};
import { t } from "@rbxts/t";
import { getFunctionError, NetworkingFunctionError } from "./errors";
import { createMiddlewareProcessor } from "../middleware/createMiddlewareProcessor";
import { FunctionMiddlewareList, Middleware, MiddlewareFactory, MiddlewareProcessor } from "../middleware/types";
import { NetworkInfo } from "../types";
import { Skip } from "../middleware/skip";
import { Players } from "@rbxts/services";
import {
	ArbitaryGuards,
	ClientHandler,
	ClientReceiver,
	ClientSender,
	FunctionConfiguration,
	FunctionCreateConfiguration,
	FunctionMetadata,
	RequestInfo,
} from "./types";
import { SignalContainer } from "../util/createSignalContainer";
import { FunctionNetworkingEvents } from "../handlers";

export function createClientHandler<S, C>(
	serverRemotes: Map<string, RemoteEvent>,
	clientRemotes: Map<string, RemoteEvent>,
	networkInfos: Map<string, NetworkInfo>,
	functionGuards: FunctionMetadata<C, S>,
	config: FunctionCreateConfiguration<C>,
	signals: SignalContainer<FunctionNetworkingEvents>,
): ClientHandler<S, C> {
	const handler = {} as ClientHandler<S, C>;
	const processors = new Map<string, MiddlewareProcessor<unknown[], unknown>>();
	const requestInfo: RequestInfo = {
		nextId: 0,
		requests: new Map(),
	};

	function createMethod(name: string, networkInfo: NetworkInfo, remote: RemoteEvent) {
		if (handler[name as keyof S] !== undefined) return;
		handler[name as keyof S] = createClientMethod(
			functionGuards.returns[name],
			config.middleware?.[name as never] ?? [],
			processors,
			networkInfo,
			requestInfo,
			name,
			remote,
			config,
			signals,
		) as never;
	}

	for (const [alias, remote] of serverRemotes) {
		const name = alias.sub(3);
		const networkInfo = networkInfos.get(name)!;
		createMethod(name, networkInfo, remote);

		remote.OnClientEvent.Connect((id, processResult: boolean | string, result) => {
			if (!t.number(id)) return;

			const request = requestInfo.requests.get(id);
			requestInfo.requests.delete(id);

			if (request) {
				request(result, getFunctionError(processResult));
			}
		});
	}

	for (const [alias, remote] of clientRemotes) {
		// invoke callback
		const name = alias.sub(3);
		const networkInfo = networkInfos.get(name)!;
		createMethod(name, networkInfo, remote);

		remote.OnClientEvent.Connect((id, ...args: unknown[]) => {
			const guards = functionGuards.incoming[name];
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
						return remote.FireServer(id, NetworkingFunctionError.BadRequest);
					}
				}
			}

			const processor = processors.get(name);
			if (processor) {
				const result = processor(undefined, ...args);
				result
					.then((value) => remote.FireServer(id, getProcessResult(value), value))
					.catch((reason) => {
						warn(`Failed to process request to ${name}`);
						warn(reason);
						remote.FireServer(id, false);
					});
			} else {
				remote.FireServer(id, false);
			}
		});
	}

	return handler;
}

type ClientMethod = ClientSender<unknown[], unknown> & ClientReceiver<unknown[], unknown>;
function createClientMethod(
	guard: t.check<unknown>,
	middleware: MiddlewareFactory<unknown[], unknown>[],
	processors: Map<string, Middleware<unknown[], unknown>>,
	networkInfo: NetworkInfo,
	requestInfo: RequestInfo,
	name: string,
	remote: RemoteEvent,
	config: FunctionCreateConfiguration<unknown>,
	signals: SignalContainer<FunctionNetworkingEvents>,
) {
	const method: { [k in keyof ClientMethod]: ClientMethod[k] } = {
		invoke(...args: unknown[]) {
			return this.invokeWithTimeout(config.defaultTimeout, ...args);
		},

		invokeWithTimeout(timeout: number, ...args: unknown[]) {
			return Promise.race([
				timeoutPromise(timeout, NetworkingFunctionError.Timeout),
				new Promise((resolve, reject, onCancel) => {
					const id = requestInfo.nextId++;
					requestInfo.requests.set(id, (value, rejection) => {
						if (rejection) return reject(rejection);
						if (!config.disableIncomingGuards && !guard(value)) {
							if (config.warnOnInvalidGuards) {
								warn(`Server returned invalid value from event '${name}':`, value);
							}
							signals.fire("onBadResponse", Players.LocalPlayer, {
								networkInfo,
								value,
							});
							return reject(NetworkingFunctionError.InvalidResult);
						}

						resolve(value);
					});

					onCancel(() => {
						requestInfo.requests.delete(id);
					});

					remote.FireServer(id, ...args);
				}),
			]);
		},

		setCallback(callback) {
			if (processors.has(name)) warn(`Function.setCallback was called multiple times for ${name}`);

			const processor = createMiddlewareProcessor(middleware, networkInfo, (_, ...args) => callback(...args));
			processors.set(name, processor);
		},

		predict(...args) {
			return new Promise((resolve, reject) => {
				const processor = processors.get(name);
				if (!processor) return reject(NetworkingFunctionError.Unprocessed);

				resolve(processor(undefined, ...args));
			});
		},
	};

	setmetatable(method, {
		__call: (method, ...args) => {
			return method.invoke(...args);
		},
	});

	return method;
}

function timeoutPromise(timeout: number, rejectValue: unknown) {
	return Promise.delay(timeout).then(() => Promise.reject(rejectValue));
}

function getProcessResult(value: unknown) {
	return value === Skip ? NetworkingFunctionError.Cancelled : true;
}
