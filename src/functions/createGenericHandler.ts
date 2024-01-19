import { NetworkingFunctionError } from "../function/errors";
import { NetworkInfo } from "../types";
import { SkipBadRequest } from "../middleware/skip";
import { FunctionNetworkingEvents } from "../handlers";
import { ClientHandler, FunctionCreateConfiguration, FunctionMetadata, ServerHandler } from "./types";
import { SignalContainer } from "../util/createSignalContainer";
import { createFunctionReceiver, FunctionReceiverInterface } from "../function/createFunctionReceiver";
import { createFunctionSender, FunctionSenderInterface } from "../function/createFunctionSender";
import { createGuardMiddleware } from "../middleware/createGuardMiddleware";
import { Players } from "@rbxts/services";

export type MethodCreator = (
	config: FunctionCreateConfiguration<unknown>,
	receiver?: FunctionReceiverInterface,
	sender?: FunctionSenderInterface,
) => unknown;

export function createGenericHandler<T extends ClientHandler<S, R> | ServerHandler<S, R>, S, R>(
	globalName: string,
	receiverNames: string[],
	senderNames: string[],
	receiverPrefix: string,
	senderPrefix: string,
	metadata: FunctionMetadata<R, S>,
	config: FunctionCreateConfiguration<R>,
	signals: SignalContainer<FunctionNetworkingEvents>,
	createMethod: MethodCreator,
): T {
	const handler = {} as T;

	const receiverNameSet = new Set(receiverNames);
	const senderNameSet = new Set(senderNames);
	for (const name of new Set([...receiverNames, ...senderNames])) {
		const configMiddleware = config.middleware[name as keyof R];
		const incomingMiddleware = configMiddleware ? table.clone(configMiddleware) : [];
		const isReceiver = receiverNameSet.has(name);
		const isSender = senderNameSet.has(name);
		const networkInfo: NetworkInfo = {
			eventType: "Function",
			globalName,
			name,
		};

		if (!config.disableIncomingGuards && isReceiver) {
			const guards = metadata.incoming[name];
			assert(guards);

			incomingMiddleware.unshift(
				createGuardMiddleware(
					name,
					guards[0],
					guards[1],
					networkInfo,
					config.warnOnInvalidGuards,
					signals,
					SkipBadRequest as unknown,
				),
			);
		}

		const receiver = isReceiver
			? createFunctionReceiver({
					namespace: globalName,
					debugName: name,
					id: isSender ? `${receiverPrefix}${name}` : name,
					networkInfo,
					incomingMiddleware,
			  })
			: undefined;

		const sender = isSender
			? createFunctionSender({
					namespace: globalName,
					debugName: name,
					id: isReceiver ? `${senderPrefix}${name}` : name,
					networkInfo,
					responseMiddleware: config.disableIncomingGuards
						? undefined
						: (player, value, resolve, reject) => {
								const returnGuard = metadata.returns[name];
								if (returnGuard && !returnGuard(value)) {
									reject(NetworkingFunctionError.InvalidResult);

									signals.fire("onBadResponse", player ?? Players.LocalPlayer, {
										networkInfo,
										value,
									});
								} else {
									resolve(value);
								}
						  },
			  })
			: undefined;

		handler[name as keyof S] = createMethod(config, receiver, sender) as never;
	}

	return handler;
}
