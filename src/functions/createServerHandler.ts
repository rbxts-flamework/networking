import { Players } from "@rbxts/services";
import { t } from "@rbxts/t";
import { getFunctionError, NetworkingFunctionError } from "./errors";
import { createMiddlewareProcessor } from "../middleware/createMiddlewareProcessor";
import { FunctionMiddlewareList, Middleware, MiddlewareFactory, MiddlewareProcessor } from "../middleware/types";
import { NetworkInfo } from "../types";
import { Skip } from "../middleware/skip";
import { FunctionNetworkingEvents } from "../handlers";
import {
	ArbitaryGuards,
	FunctionConfiguration,
	FunctionCreateConfiguration,
	RequestInfo,
	ServerHandler,
	ServerReceiver,
	ServerSender,
} from "./types";
import { SignalContainer } from "../util/createSignalContainer";

export function createServerHandler<S, C>(
	serverRemotes: Map<string, RemoteEvent>,
	clientRemotes: Map<string, RemoteEvent>,
	networkInfos: Map<string, NetworkInfo>,
	serverEvents: ArbitaryGuards,
	clientEvents: ArbitaryGuards,
	config: FunctionCreateConfiguration<S>,
	signals: SignalContainer<FunctionNetworkingEvents>,
): ServerHandler<C, S> {
	const handler = {} as ServerHandler<C, S>;
	const processors = new Map<string, MiddlewareProcessor<unknown[], unknown>>();
	const players = new Map<Player, RequestInfo>();

	function createMethod(name: string, networkInfo: NetworkInfo, remote: RemoteEvent) {
		if (handler[name as keyof C] !== undefined) return;
		handler[name as keyof C] = createServerMethod(
			(serverEvents[name] ?? clientEvents[name])[1],
			config.middleware?.[name as never] ?? [],
			processors,
			networkInfo,
			players,
			name,
			remote,
			config,
			signals,
		) as never;
	}

	for (const [alias, remote] of clientRemotes) {
		// create server method
		const name = alias.sub(3);
		const networkInfo = networkInfos.get(name)!;
		createMethod(name, networkInfo, remote);

		remote.OnServerEvent.Connect((player, id, processResult, result) => {
			if (!t.number(id)) return;

			const requestInfo = getRequestInfo(player, players);
			const request = requestInfo.requests.get(id);
			requestInfo.requests.delete(id);

			if (request) {
				request(result, getFunctionError(processResult));
			}
		});
	}

	for (const [alias, remote] of serverRemotes) {
		// invoke callback
		const name = alias.sub(3);
		const networkInfo = networkInfos.get(name)!;
		createMethod(name, networkInfo, remote);

		remote.OnServerEvent.Connect((player, id, ...args) => {
			const guards = serverEvents[name];
			if (!guards) return;

			if (!config.disableIncomingGuards) {
				const paramGuards = guards[0][0];
				const restGuard = guards[0][1];

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
						return remote.FireClient(player, id, NetworkingFunctionError.BadRequest);
					}
				}
			}

			const processor = processors.get(name);
			if (processor) {
				const result = processor(player, ...args);
				result
					.then((value) => remote.FireClient(player, id, getProcessResult(value), value))
					.catch((reason) => {
						warn(`Failed to process request to ${name}`);
						warn(reason);
						remote.FireClient(player, id, false);
					});
			} else {
				remote.FireClient(player, id, false);
			}
		});
	}

	Players.PlayerRemoving.Connect((player) => {
		players.delete(player);
	});

	return handler;
}

type ServerMethod = ServerSender<unknown[], unknown> & ServerReceiver<unknown[], unknown>;
function createServerMethod(
	guard: t.check<unknown>,
	middleware: MiddlewareFactory<unknown[], unknown>[],
	processors: Map<string, Middleware<unknown[], unknown>>,
	networkInfo: NetworkInfo,
	players: Map<Player, RequestInfo>,
	name: string,
	remote: RemoteEvent,
	config: FunctionCreateConfiguration<unknown>,
	signals: SignalContainer<FunctionNetworkingEvents>,
) {
	const method: { [k in keyof ServerMethod]: ServerMethod[k] } = {
		invoke(player: Player, ...args: unknown[]) {
			return this.invokeWithTimeout(player, config.defaultTimeout, ...args);
		},

		invokeWithTimeout(player: Player, timeout: number, ...args: unknown[]) {
			return Promise.race([
				timeoutPromise(timeout, NetworkingFunctionError.Timeout),
				new Promise((resolve, reject, onCancel) => {
					const requestInfo = getRequestInfo(player, players);
					const id = requestInfo.nextId++;
					requestInfo.requests.set(id, (value, rejection) => {
						if (rejection) return reject(rejection);
						if (!config.disableIncomingGuards && !guard(value)) {
							if (config.warnOnInvalidGuards) {
								warn(`'${player}' returned invalid value from event '${name}':`, value);
							}
							signals.fire("onBadResponse", player, {
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

					remote.FireClient(player, id, ...args);
				}),
			]);
		},

		setCallback(callback) {
			if (processors.has(name)) warn(`Function.setCallback was called multiple times for ${name}`);

			const processor = createMiddlewareProcessor(middleware, networkInfo, callback as never);
			processors.set(name, processor);
		},

		predict(player, ...args) {
			return new Promise((resolve, reject) => {
				const processor = processors.get(name);
				if (!processor) return reject(NetworkingFunctionError.Unprocessed);

				resolve(processor(player, ...args));
			});
		},
	};

	setmetatable(method, {
		__call: (method, player, ...args) => {
			return method.invoke(player as Player, ...args);
		},
	});

	return method;
}

function getRequestInfo(player: Player, map: Map<Player, RequestInfo>) {
	let requestInfo = map.get(player);
	if (requestInfo) return requestInfo;

	requestInfo = {
		nextId: 0,
		requests: new Map(),
	};

	map.set(player, requestInfo);
	return requestInfo;
}

function timeoutPromise(timeout: number, rejectValue: unknown) {
	return Promise.delay(timeout).then(() => Promise.reject(rejectValue));
}

function getProcessResult(value: unknown) {
	return value === Skip ? NetworkingFunctionError.Cancelled : true;
}
