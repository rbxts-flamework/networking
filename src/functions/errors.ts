import { Flamework } from "@flamework/core";

export const isNetworkingFunctionError = Flamework.createGuard<NetworkingFunctionError>();
export enum NetworkingFunctionError {
	Timeout = "Timeout",
	Failure = "Failure",
	BadRequest = "BadRequest",
	Unprocessed = "Unprocessed",
	InvalidResult = "InvalidResult",
}

export function getFunctionError(value: unknown) {
	if (typeIs(value, "boolean")) {
		return value === false ? NetworkingFunctionError.Unprocessed : undefined;
	} else if (isNetworkingFunctionError(value)) {
		return value as NetworkingFunctionError;
	}
}
