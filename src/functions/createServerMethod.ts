import { FunctionReceiverInterface } from "../function/createFunctionReceiver";
import { FunctionSenderInterface } from "../function/createFunctionSender";
import { NetworkingFunctionError } from "../function/errors";
import { FunctionCreateConfiguration, ServerReceiver, ServerSender } from "./types";

type ServerMethod = ServerSender<unknown[], unknown> & ServerReceiver<unknown[], unknown>;

export function createServerMethod(
	config: FunctionCreateConfiguration<unknown>,
	receiver?: FunctionReceiverInterface,
	sender?: FunctionSenderInterface,
) {
	const method: { [k in keyof ServerMethod]: ServerMethod[k] } = {
		invoke(player: Player, ...args: unknown[]) {
			return this.invokeWithTimeout(player, config.defaultTimeout, ...args);
		},

		invokeWithTimeout(player: Player, timeout: number, ...args: unknown[]) {
			assert(sender, "This is not a sender remote.");

			return Promise.race([
				timeoutPromise(timeout, NetworkingFunctionError.Timeout),
				sender.invokeClient(player, ...args),
			]);
		},

		setCallback(callback) {
			assert(receiver, "This is not a receiver remote.");

			receiver.setServerCallback(callback);
		},

		predict(player, ...args) {
			assert(receiver, "This is not a receiver remote.");

			return receiver.invoke(player, ...args);
		},
	};

	setmetatable(method, {
		__call: (method, player, ...args) => {
			return method.invoke(player as Player, ...args);
		},
	});

	return method;
}

function timeoutPromise(timeout: number, rejectValue: unknown) {
	return Promise.delay(timeout).then(() => Promise.reject(rejectValue));
}
