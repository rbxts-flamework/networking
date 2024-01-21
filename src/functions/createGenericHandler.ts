import { NetworkingFunctionError } from "../function/errors";
import { NetworkInfo } from "../types";
import { SkipBadRequest } from "../middleware/skip";
import { FunctionNetworkingEvents } from "../handlers";
import { ClientHandler, FunctionCreateConfiguration, Functions, NamespaceMetadata, ServerHandler } from "./types";
import { SignalContainer } from "../util/createSignalContainer";
import { createFunctionReceiver, FunctionReceiverInterface } from "../function/createFunctionReceiver";
import { createFunctionSender, FunctionSenderInterface } from "../function/createFunctionSender";
import { createGuardMiddleware } from "../middleware/createGuardMiddleware";
import { Players } from "@rbxts/services";
import { getNamespaceConfig } from "../util/getNamespaceConfig";

export type MethodCreator = (
	config: FunctionCreateConfiguration<unknown>,
	receiver?: FunctionReceiverInterface,
	sender?: FunctionSenderInterface,
) => unknown;

export function createGenericHandler<T extends ClientHandler<S, R> | ServerHandler<S, R>, S, R>(
	globalName: string,
	namespaceName: string | undefined,
	receiverPrefix: string,
	senderPrefix: string,
	metadata: NamespaceMetadata<R, S>,
	config: FunctionCreateConfiguration<R>,
	signals: SignalContainer<FunctionNetworkingEvents>,
	createMethod: MethodCreator,
): T {
	const handler = {} as T;

	const receiverNameSet = new Set(metadata.incomingIds);
	const senderNameSet = new Set(metadata.outgoingIds);
	for (const name of new Set([...metadata.incomingIds, ...metadata.outgoingIds])) {
		const configMiddleware = config.middleware[name as keyof Functions<R>];
		const incomingMiddleware = configMiddleware !== undefined ? table.clone(configMiddleware) : [];
		const isReceiver = receiverNameSet.has(name);
		const isSender = senderNameSet.has(name);
		const effectiveName = namespaceName !== undefined ? `${namespaceName}/${name}` : name;
		const networkInfo: NetworkInfo = {
			eventType: "Function",
			name: effectiveName,
			globalName,
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
					id: isSender ? `${receiverPrefix}${effectiveName}` : effectiveName,
					networkInfo,
					incomingMiddleware,
			  })
			: undefined;

		const sender = isSender
			? createFunctionSender({
					namespace: globalName,
					debugName: name,
					id: isReceiver ? `${senderPrefix}${effectiveName}` : effectiveName,
					networkInfo,
					responseMiddleware: config.disableIncomingGuards
						? undefined
						: (player, value, resolve, reject) => {
								const returnGuard = metadata.outgoing[name];
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

		handler[name as keyof T] = createMethod(config, receiver, sender) as never;
	}

	for (const namespaceId of metadata.namespaceIds) {
		const namespace = metadata.namespaces[namespaceId];
		handler[namespaceId as keyof T] = createGenericHandler(
			globalName,
			namespaceName !== undefined ? `${namespaceName}/${namespaceId}` : namespaceId,
			receiverPrefix,
			senderPrefix,
			namespace as never,
			getNamespaceConfig(config, namespaceId),
			signals,
			createMethod,
		);
	}

	return handler;
}
