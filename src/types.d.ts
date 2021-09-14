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

export interface NetworkingObfuscationMarker {
	/**
	 * An internal marker type used to signify to Flamework to obfuscate access expressions.
	 * @hidden
	 * @deprecated
	 */
	readonly _nominal_NetworkingObfuscationMarker: unique symbol;
}

export type FunctionParameters<T> = T extends (...args: infer P) => unknown ? P : never;
export type FunctionReturn<T> = T extends (...args: never[]) => infer R ? R : never;

/**
 * A very gross hack to get rid of doc comment duplication on events.
 */
export type StripTSDoc<T, E extends string | number | symbol = keyof T> = {
	[k in E]: k extends keyof T ? T[k] : never;
};
