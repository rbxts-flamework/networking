export interface NetworkInfo {
	/**
	 * The name provided for this event.
	 */
	name: string;

	/**
	 * The (generated) global name used for distinguishing different createEvent calls.
	 */
	globalName: string;

	/**
	 * Whether this remote is an event or function.
	 */
	eventType: "Event" | "Function";
}

export type FunctionParameters<T> = T extends (...args: infer P) => unknown ? P : never;
export type FunctionReturn<T> = T extends (...args: never[]) => infer R ? R : never;
