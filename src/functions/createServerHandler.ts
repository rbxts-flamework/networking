import { Players } from "@rbxts/services";
import { t } from "@rbxts/t";
import { getFunctionError, NetworkingFunctionError } from "./errors";
import { createMiddlewareProcessor } from "../middleware/createMiddlewareProcessor";
import { FunctionMiddlewareList, Middleware, MiddlewareFactory } from "../middleware/types";
import { NetworkInfo } from "../types";
import { ArbitaryGuards, RequestInfo, ServerHandler, ServerReceiver, ServerSender } from "./types";
import { Skip } from "middleware/skip";
import { fireNetworkHandler } from "handlers";

export function createServerHandler<S, C>(
	serverRemotes: Map<string, RemoteEvent>,
	clientRemotes: Map<string, RemoteEvent>,
	networkInfos: Map<string, NetworkInfo>,
	serverEvents: ArbitaryGuards,
	clientEvents: ArbitaryGuards,
	middlewareFactoryList?: FunctionMiddlewareList<S>,
): ServerHandler<C, S> {
	const handler = {} as ServerHandler<C, S>;
	const processors = new Map<string, Middleware<unknown[], unknown>>();
	const players = new Map<Player, RequestInfo>();

	for (const [alias, remote] of clientRemotes) {
		// create server method
		const name = alias.sub(3);
		const networkInfo = networkInfos.get(name)!;
		handler[name as keyof C] = createServerMethod(
			clientEvents[name][1],
			middlewareFactoryList?.[name as never] ?? [],
			processors,
			networkInfo,
			players,
			name,
			remote,
		) as never;

		remote.OnServerEvent.Connect((player, id, processResult, result) => {
			if (!typeIs(id, "number")) return;

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
		remote.OnServerEvent.Connect((player, id, ...args) => {
			const guards = serverEvents[name];
			if (!guards) return;

			for (let i = 0; i < guards[0].size(); i++) {
				const guard = guards[0][i];
				if (!guard(args[i])) {
					fireNetworkHandler("onBadRequest", player, networkInfo, i);
					return remote.FireClient(player, id, NetworkingFunctionError.BadRequest);
				}
			}

			const processor = processors.get(name);
			if (processor) {
				const result = processor(player, ...args);
				remote.FireClient(player, id, result === Skip ? NetworkingFunctionError.Cancelled : true, result);
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
) {
	const method: { [k in keyof ServerMethod]: ServerMethod[k] } = {
		invoke(player: Player, ...args: unknown[]) {
			return Promise.race([
				timeout(10, NetworkingFunctionError.Timeout),
				new Promise((resolve, reject, onCancel) => {
					const requestInfo = getRequestInfo(player, players);
					const id = requestInfo.nextId++;
					requestInfo.requests.set(id, (value, rejection) => {
						if (rejection) return reject(rejection);
						if (!guard(value)) {
							fireNetworkHandler("onBadResponse", player, networkInfo);
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

function timeout(timeout: number, rejectValue: unknown) {
	return Promise.delay(timeout).then(() => Promise.reject(rejectValue));
}
