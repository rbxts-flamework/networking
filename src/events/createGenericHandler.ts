import { EventNetworkingEvents } from "../handlers";
import { NetworkInfo } from "../types";
import {
	ArbitaryGuards,
	ClientHandler,
	ClientReceiver,
	ClientSender,
	EventCreateConfiguration,
	ServerHandler,
} from "./types";
import { SignalContainer } from "../util/createSignalContainer";
import { createGuardMiddleware } from "../middleware/createGuardMiddleware";
import { EventInterface, createEvent } from "../event/createEvent";

export function createGenericHandler<T extends ClientHandler<S, R> | ServerHandler<S, R>, S, R>(
	globalName: string,
	receiverNames: string[],
	senderNames: string[],
	incomingGuards: ArbitaryGuards,
	config: EventCreateConfiguration<R>,
	signals: SignalContainer<EventNetworkingEvents>,
	method: (event: EventInterface) => unknown,
): T {
	const handler = {} as T;

	const receiverNameSet = new Set(receiverNames);
	for (const name of new Set([...receiverNames, ...senderNames])) {
		const isReceiver = receiverNameSet.has(name);
		const configMiddleware = config.middleware[name as keyof R];
		const incomingMiddleware = configMiddleware ? table.clone(configMiddleware) : [];
		const networkInfo: NetworkInfo = {
			eventType: "Event",
			globalName,
			name,
		};

		if (!config.disableIncomingGuards && isReceiver) {
			const guards = incomingGuards[name];
			assert(guards);

			incomingMiddleware.unshift(
				createGuardMiddleware(name, guards[0], guards[1], networkInfo, config.warnOnInvalidGuards, signals),
			);
		}

		const event = createEvent({
			namespace: globalName,
			id: name,
			debugName: name,
			networkInfo,
			incomingMiddleware,
		});

		handler[name as keyof T] = method(event) as never;
	}

	return handler;
}

type ClientMethod = ClientSender<unknown[]> & ClientReceiver<unknown[]>;
function createClientMethod(event: EventInterface) {
	const method: { [k in keyof ClientMethod]: ClientMethod[k] } = {
		fire(...args) {
			event.fireServer(...args);
		},

		connect(callback) {
			return event.connectClient(callback);
		},

		predict(...args) {
			return event.invoke(undefined, ...args);
		},
	};

	setmetatable(method, {
		__call: (method, ...args) => {
			method.fire(...args);
		},
	});

	return method;
}
