import { NetworkInfo } from "../types";
import { Middleware, MiddlewareFactory } from "./types";

export function createMiddlewareProcessor<I extends readonly unknown[], O>(
	middlewareFactories: MiddlewareFactory<I, O>[] | undefined,
	networkInfo: NetworkInfo,
	finalize: Middleware<I, O>,
) {
	const middleware = new Array<Middleware<I, O>>();

	if (!middlewareFactories || middlewareFactories.size() === 0) {
		middleware[0] = finalize;
	} else {
		for (let i = middlewareFactories.size() - 1; i >= 0; i--) {
			const factory = middlewareFactories[i];
			middleware[i] = factory(middleware[i + 1] ?? finalize, networkInfo);
		}
	}

	return middleware[0];
}
