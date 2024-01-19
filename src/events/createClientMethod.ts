import { ClientReceiver, ClientSender } from "./types";
import { EventInterface } from "../event/createEvent";

type ClientMethod = ClientSender<never[]> & ClientReceiver<never[]>;

export function createClientMethod(receiver: EventInterface, sender: EventInterface) {
	const method: { [k in keyof ClientMethod]: ClientMethod[k] } = {
		fire(...args) {
			sender.fireServer(...args);
		},

		connect(callback) {
			return receiver.connectClient(callback as never);
		},

		predict(...args) {
			return receiver.invoke(undefined, ...args);
		},
	};

	setmetatable(method, {
		__call: (method, ...args) => {
			method.fire(...(args as never[]));
		},
	});

	return method as ClientMethod;
}
