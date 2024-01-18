import { FunctionReceiverInterface } from "../function/createFunctionReceiver";
import { FunctionSenderInterface } from "../function/createFunctionSender";
import { NetworkingFunctionError } from "../function/errors";
import { ClientReceiver, ClientSender, FunctionCreateConfiguration } from "./types";

type ClientMethod = ClientSender<unknown[], unknown> & ClientReceiver<unknown[], unknown>;

export function createClientMethod(
	config: FunctionCreateConfiguration<unknown>,
	receiver?: FunctionReceiverInterface,
	sender?: FunctionSenderInterface,
) {
	const method: { [k in keyof ClientMethod]: ClientMethod[k] } = {
		invoke(...args: unknown[]) {
			return this.invokeWithTimeout(config.defaultTimeout, ...args);
		},

		invokeWithTimeout(timeout: number, ...args: unknown[]) {
			assert(sender, "This is not a sender remote.");

			return Promise.race([
				timeoutPromise(timeout, NetworkingFunctionError.Timeout),
				sender.invokeServer(...args),
			]);
		},

		setCallback(callback) {
			assert(receiver, "This is not a receiver remote.");

			receiver.setClientCallback(callback);
		},

		predict(...args) {
			assert(receiver, "This is not a receiver remote.");

			return receiver.invoke(undefined, ...args);
		},
	};

	setmetatable(method, {
		__call: (method, ...args) => {
			return method.invoke(...args);
		},
	});

	return method;
}

function timeoutPromise(timeout: number, rejectValue: unknown) {
	return Promise.delay(timeout).then(() => Promise.reject(rejectValue));
}
