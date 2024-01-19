import { ClientReceiver, ClientSender } from "./types";
import { EventInterface } from "../event/createEvent";

type ClientMethod = ClientSender<never[]> & ClientReceiver<never[]>;

export function createClientMethod(event: EventInterface) {
	const method: { [k in keyof ClientMethod]: ClientMethod[k] } = {
		fire(...args) {
			event.fireServer(...args);
		},

		connect(callback) {
			return event.connectClient(callback as never);
		},

		predict(...args) {
			return event.invoke(undefined, ...args);
		},
	};

	setmetatable(method, {
		__call: (method, ...args) => {
			method.fire(...(args as never[]));
		},
	});

	return method as ClientMethod;
}
