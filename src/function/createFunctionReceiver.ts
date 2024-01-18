/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunService } from "@rbxts/services";
import { createEvent } from "../event/createEvent";
import { NetworkInfo } from "../types";
import { NetworkingFunctionError } from "./errors";
import { createMiddlewareProcessor } from "../middleware/createMiddlewareProcessor";
import { MiddlewareFactory, MiddlewareProcessor } from "../middleware/types";
import { Skip, SkipBadRequest } from "../middleware/skip";

export interface CreateFunctionReceiverOptions {
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
	incomingMiddleware?: MiddlewareFactory<any[], any>[];
}

export interface RequestInfo {
	nextId: number;
	requests: Map<number, (value: unknown, rejection?: NetworkingFunctionError) => void>;
}

export interface FunctionReceiverInterface {
	setServerCallback(callback: (player: Player, ...args: unknown[]) => unknown): void;
	setClientCallback(callback: (...args: unknown[]) => unknown): void;
	invoke(player: Player | undefined, ...args: unknown[]): Promise<unknown>;
}

export function createFunctionReceiver(options: CreateFunctionReceiverOptions): FunctionReceiverInterface {
	const event = createEvent({
		namespace: options.namespace,
		debugName: options.debugName,
		id: options.id,
		networkInfo: options.networkInfo,
	});

	let callback: MiddlewareProcessor<unknown[], unknown>;

	const setCallback = (newCallback: (...args: never[]) => unknown) => {
		callback = createMiddlewareProcessor(options.incomingMiddleware, options.networkInfo, (player, ...args) => {
			if (RunService.IsServer()) {
				return newCallback(player as never, ...(args as never[]));
			} else {
				return newCallback(...(args as never[]));
			}
		});
	};

	const processRequest = (player: Player | undefined, id: unknown, ...args: unknown[]) => {
		if (!callback) {
			return event.fireEither(player, id, NetworkingFunctionError.Unprocessed);
		}

		callback(player, ...args)
			.then((value) => event.fireEither(player, id, getProcessResult(value), value))
			.catch((reason) => {
				warn(`Failed to process request to '${options.debugName}'`);
				warn(reason);

				event.fireEither(player, id, false);
			});
	};

	if (RunService.IsServer()) {
		event.connectServer((player, id, ...args) => processRequest(player, id, ...args));
	} else {
		event.connectClient((id, ...args) => processRequest(undefined, id, ...args));
	}

	return {
		setServerCallback(callback) {
			setCallback(callback);
		},

		setClientCallback(callback) {
			setCallback(callback);
		},

		invoke(player, ...args) {
			if (!callback) {
				return Promise.reject(NetworkingFunctionError.Unprocessed);
			}

			return callback(player, ...args);
		},
	};
}

function getProcessResult(value: unknown) {
	return value === Skip
		? NetworkingFunctionError.Cancelled
		: value === SkipBadRequest
		? NetworkingFunctionError.BadRequest
		: true;
}
