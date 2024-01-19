import { t } from "@rbxts/t";
import { MiddlewareFactory } from "./types";
import { SignalContainer } from "../util/createSignalContainer";
import { EventNetworkingEvents } from "../handlers";
import { NetworkInfo } from "../types";
import { Players } from "@rbxts/services";

export function createGuardMiddleware<I extends unknown[], O>(
	name: string,
	fixedParameters: t.check<unknown>[],
	restParameter: t.check<unknown> | undefined,
	networkInfo: NetworkInfo,
	warnOnInvalid: boolean,
	signals: SignalContainer<EventNetworkingEvents>,
	failureValue?: O,
): MiddlewareFactory<I, O> {
	return (processNext) => {
		return (player, ...args) => {
			for (let i = 0; i < math.max(fixedParameters.size(), args.size()); i++) {
				const guard = fixedParameters[i] ?? restParameter;
				if (guard && !guard(args[i])) {
					if (warnOnInvalid) {
						if (player) {
							warn(`'${player}' sent invalid arguments for event '${name}' (arg #${i}):`, args[i]);
						} else {
							warn(`Server sent invalid arguments for event '${name}' (arg #${i}):`, args[i]);
						}
					}

					signals.fire("onBadRequest", player ?? Players.LocalPlayer, {
						networkInfo,
						argIndex: i,
						argValue: args[i],
					});

					return failureValue!;
				}
			}

			return processNext(player, ...args);
		};
	};
}
