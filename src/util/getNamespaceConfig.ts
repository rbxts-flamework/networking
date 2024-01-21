import { EventCreateConfiguration } from "../events/types";
import { FunctionCreateConfiguration } from "../functions/types";

type ConfigType = EventCreateConfiguration<unknown> | FunctionCreateConfiguration<unknown>;

/**
 * Creates a new config with the namespace's middleware at the top level.
 */
export function getNamespaceConfig<T extends ConfigType>(config: T, namespaceId: string) {
	return {
		...config,
		middleware: config.middleware[namespaceId as never] ?? {},
	};
}
