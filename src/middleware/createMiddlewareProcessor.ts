import { NetworkInfo } from "../types";
import { Middleware, MiddlewareFactory, MiddlewareProcessor } from "./types";

export function createMiddlewareProcessor<I extends readonly unknown[], O>(
	middlewareFactories: MiddlewareFactory<I, O>[] | undefined,
	networkInfo: NetworkInfo,
	finalize: Middleware<I, O>,
): MiddlewareProcessor<I, O> {
	const middleware = new Array<Middleware<I, O>>();

	if (!middlewareFactories || middlewareFactories.size() === 0) {
		middleware[0] = finalize;
	} else {
		for (let i = middlewareFactories.size() - 1; i >= 0; i--) {
			const factory = middlewareFactories[i];
			const processNext = middleware[i + 1] ?? finalize;
			middleware[i] = factory(async (player, ...args) => processNext(player, ...args), networkInfo);
		}
	}

	return async (player?: Player, ...args: I) => middleware[0](player, ...args);
}
