import { EventNetworkingEvents } from "../handlers";
import { NetworkInfo } from "../types";
import {
	ArbitaryGuards,
	ClientHandler,
	ClientReceiver,
	ClientSender,
	EventCreateConfiguration,
	EventMetadata,
	ServerHandler,
} from "./types";
import { SignalContainer } from "../util/createSignalContainer";
import { createGuardMiddleware } from "../middleware/createGuardMiddleware";
import { EventInterface, createEvent } from "../event/createEvent";

export function createGenericHandler<T extends ClientHandler<S, R> | ServerHandler<S, R>, S, R>(
	globalName: string,
	receiverNames: string[],
	senderNames: string[],
	metadata: EventMetadata<R, S>,
	config: EventCreateConfiguration<R>,
	signals: SignalContainer<EventNetworkingEvents>,
	method: (receiver: EventInterface, sender: EventInterface) => unknown,
): T {
	const handler = {} as T;

	const receiverNameSet = new Set(receiverNames);
	for (const name of new Set([...receiverNames, ...senderNames])) {
		const isIncomingUnreliable = metadata.incomingUnreliable[name] === true;
		const isOutgoingUnreliable = metadata.outgoingUnreliable[name] === true;
		const isReceiver = receiverNameSet.has(name);
		const configMiddleware = config.middleware[name as keyof R];
		const incomingMiddleware = configMiddleware ? table.clone(configMiddleware) : [];
		const networkInfo: NetworkInfo = {
			eventType: "Event",
			globalName,
			name,
		};

		if (!config.disableIncomingGuards && isReceiver) {
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
				id: unreliable ? `unreliable:${name}` : name,
				debugName: name,
				networkInfo,
				incomingMiddleware,
			});
		};

		const receiver = create(isIncomingUnreliable);
		const sender = isOutgoingUnreliable === isIncomingUnreliable ? receiver : create(isOutgoingUnreliable);

		handler[name as keyof T] = method(receiver, sender) as never;
	}

	return handler;
}
