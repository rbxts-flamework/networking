import { EventNetworkingEvents } from "../handlers";
import { NetworkInfo } from "../types";
import { ClientHandler, EventCreateConfiguration, Events, NamespaceMetadata, ServerHandler } from "./types";
import { SignalContainer } from "../util/createSignalContainer";
import { createGuardMiddleware } from "../middleware/createGuardMiddleware";
import { EventInterface, createEvent } from "../event/createEvent";
import { getNamespaceConfig } from "../util/getNamespaceConfig";

export function createGenericHandler<T extends ClientHandler<S, R> | ServerHandler<S, R>, S, R>(
	globalName: string,
	namespaceName: string | undefined,
	metadata: NamespaceMetadata<R, S>,
	config: EventCreateConfiguration<R>,
	signals: SignalContainer<EventNetworkingEvents>,
	method: (receiver: EventInterface, sender: EventInterface) => unknown,
): T {
	const handler = {} as T;

	const receiverNameSet = new Set(metadata.incomingIds);
	const senderNameSet = new Set(metadata.outgoingIds);
	for (const name of new Set([...metadata.incomingIds, ...metadata.outgoingIds])) {
		const isIncoming = receiverNameSet.has(name);
		const isOutgoing = senderNameSet.has(name);
		// If there is no incoming/outgoing event, use the same reliability as the other.
		const incomingChannel = isIncoming ? metadata.incomingUnreliable : metadata.outgoingUnreliable;
		const outgoingChannel = isOutgoing ? metadata.outgoingUnreliable : metadata.incomingUnreliable;
		const isIncomingUnreliable = incomingChannel[name] === true;
		const isOutgoingUnreliable = outgoingChannel[name] === true;
		const configMiddleware = config.middleware[name as keyof Events<R>];
		const incomingMiddleware = configMiddleware !== undefined ? table.clone(configMiddleware) : [];
		const effectiveName = namespaceName !== undefined ? `${namespaceName}/${name}` : name;
		const networkInfo: NetworkInfo = {
			eventType: "Event",
			name: effectiveName,
			globalName,
		};

		if (!config.disableIncomingGuards && isIncoming) {
			const guards = metadata.incoming[name];
			assert(guards);

			incomingMiddleware.unshift(
				createGuardMiddleware(name, guards[0], guards[1], networkInfo, config.warnOnInvalidGuards, signals),
			);
		}

		const create = (unreliable: boolean) => {
			return createEvent({
				reliability: unreliable ? "unreliable" : "reliable",
				namespace: globalName,
				id: unreliable ? `unreliable:${effectiveName}` : effectiveName,
				debugName: name,
				networkInfo,
				incomingMiddleware,
			});
		};

		const receiver = create(isIncomingUnreliable);
		const sender = isOutgoingUnreliable === isIncomingUnreliable ? receiver : create(isOutgoingUnreliable);

		handler[name as keyof T] = method(receiver, sender) as never;
	}

	for (const namespaceId of metadata.namespaceIds) {
		const namespace = metadata.namespaces[namespaceId];
		handler[namespaceId as keyof T] = createGenericHandler(
			globalName,
			namespaceName !== undefined ? `${namespaceName}/${namespaceId}` : namespaceId,
			namespace as never,
			getNamespaceConfig(config, namespaceId),
			signals,
			method,
		);
	}

	return handler;
}
