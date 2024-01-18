/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunService } from "@rbxts/services";
import { createEvent } from "../event/createEvent";
import { NetworkInfo } from "../types";
import { NetworkingFunctionError, getFunctionError } from "./errors";
import { t } from "@rbxts/t";

export interface CreateFunctionSenderOptions {
	/**
	 * The namespace this event should be created in.
	 */
	namespace: string;

	/**
	 * The name of the remote instance, not necessarily unique and used for debugging purposes.
	 */
	debugName: string;

	/**
	 * The remote's ID which must be unique.
	 */
	id: string;

	/**
	 * Information about the network, which includes some of the above.
	 *
	 * Passed to the middleware.
	 */
	networkInfo: NetworkInfo;

	/**
	 * This function will be called when we receive a response, and can be used to resolve or reject values.
	 */
	responseMiddleware?: (
		player: Player | undefined,
		value: unknown,
		resolve: (value: unknown) => void,
		reject: (value: unknown) => void,
	) => void;
}

export interface RequestInfo {
	nextId: number;
	requests: Map<number, (value: unknown, rejection?: NetworkingFunctionError) => void>;
}

export interface FunctionSenderInterface {
	invokeServer(...args: unknown[]): Promise<unknown>;
	invokeClient(player: Player, ...args: unknown[]): Promise<unknown>;
}

export function createFunctionSender(options: CreateFunctionSenderOptions): FunctionSenderInterface {
	const event = createEvent({
		namespace: options.namespace,
		debugName: options.debugName,
		id: options.id,
		networkInfo: options.networkInfo,
	});

	const processResponse = (requestInfo: RequestInfo, id: unknown, processResult: unknown, result: unknown) => {
		if (!t.number(id)) {
			return;
		}

		const request = requestInfo.requests.get(id);
		requestInfo.requests.delete(id);

		if (request) {
			request(result, getFunctionError(processResult));
		}
	};

	// We don't need to defer here because we only accept responses to our explicit invocations.
	const requestInfoServer = new Map<Player, RequestInfo>();
	const requestInfoClient = createRequestInfo();
	if (RunService.IsServer()) {
		event.connectServer((player, id, processResult, result) => {
			const requestInfo = requestInfoServer.get(player);
			if (!requestInfo) {
				return;
			}

			processResponse(requestInfo, id, processResult, result);
		});
	} else {
		event.connectClient((id, processResult, result) => {
			processResponse(requestInfoClient, id, processResult, result);
		});
	}

	const createInvocation = (player: Player | undefined, id: number, requestInfo: RequestInfo) => {
		return new Promise((resolve, reject, onCancel) => {
			requestInfo.requests.set(id, (value, rejection) => {
				if (rejection) {
					return reject(rejection);
				}

				if (options.responseMiddleware) {
					options.responseMiddleware(player, value, resolve, reject);
				} else {
					resolve(value);
				}
			});

			onCancel(() => {
				requestInfo!.requests.delete(id);
			});
		});
	};

	return {
		invokeServer(...args) {
			const id = requestInfoClient.nextId++;
			event.fireServer(id, ...args);

			return createInvocation(undefined, id, requestInfoClient);
		},

		invokeClient(player, ...args) {
			let requestInfo = requestInfoServer.get(player);
			if (!requestInfo) requestInfoServer.set(player, (requestInfo = createRequestInfo()));

			const id = requestInfoClient.nextId++;
			event.fireClient(player, id, ...args);

			return createInvocation(player, id, requestInfo);
		},
	};
}

function createRequestInfo(): RequestInfo {
	return {
		nextId: 0,
		requests: new Map(),
	};
}
