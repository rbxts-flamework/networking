import { Players } from "@rbxts/services";
import { t } from "@rbxts/t";
import { getFunctionError, NetworkingFunctionError } from "./errors";
import { createMiddlewareProcessor } from "../middleware/createMiddlewareProcessor";
import { FunctionMiddlewareList, Middleware } from "../middleware/types";
import { NetworkInfo } from "../types";
import { ArbitaryGuards, RequestInfo, ServerHandler } from "./types";

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
		handler[name as keyof C] = createServerMethod(clientEvents[name][1], players, remote) as never;

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
		remote.OnServerEvent.Connect((player, id, ...args) => {
			const guards = serverEvents[name];
			if (!guards) return;

			for (let i = 0; i < guards[0].size(); i++) {
				const guard = guards[0][i];
				if (!guard(args[i])) {
					return remote.FireClient(player, id, NetworkingFunctionError.BadRequest);
				}
			}

			const processor = processors.get(name);
			remote.FireClient(player, id, processor !== undefined, processor && processor(player, ...args));
		});
	}

	handler.setCallback = function (this: unknown, event, callback) {
		if (processors.has(event as string)) warn("Function.setCallback was called multiple times.");

		const processor = createMiddlewareProcessor(
			middlewareFactoryList?.[event as never],
			networkInfos.get(event as string)!,
			callback as never,
		);

		processors.set(event as string, processor);
	};

	Players.PlayerRemoving.Connect((player) => {
		players.delete(player);
	});

	return handler;
}

function createServerMethod(guard: t.check<unknown>, players: Map<Player, RequestInfo>, remote: RemoteEvent) {
	const method = {
		invoke(player: Player, ...args: unknown[]) {
			return Promise.race([
				timeout(10, NetworkingFunctionError.Timeout),
				new Promise((resolve, reject, onCancel) => {
					const requestInfo = getRequestInfo(player, players);
					const id = requestInfo.nextId++;
					requestInfo.requests.set(id, (value, rejection) => {
						if (rejection) return reject(rejection);
						if (!guard(value)) return reject(NetworkingFunctionError.InvalidResult);

						resolve(value);
					});

					onCancel(() => {
						requestInfo.requests.delete(id);
					});

					remote.FireClient(player, id, ...args);
				}),
			]);
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
