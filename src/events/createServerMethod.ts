import { Players } from "@rbxts/services";
import { ServerReceiver, ServerSender } from "./types";
import { EventInterface } from "../event/createEvent";

type ServerMethod = ServerSender<unknown[]> & ServerReceiver<unknown[]>;

export function createServerMethod(event: EventInterface) {
	const method: { [k in keyof ServerMethod]: ServerMethod[k] } = {
		fire(players, ...args) {
			if (typeIs(players, "Instance")) {
				event.fireClient(players, ...args);
			} else {
				for (const player of players) {
					event.fireClient(player, ...args);
				}
			}
		},

		broadcast(...args) {
			event.fireAllClients(...args);
		},

		except(players, ...args) {
			if (typeIs(players, "Instance")) players = [players];

			for (const player of Players.GetPlayers()) {
				if (!players.includes(player)) {
					this.fire(player, ...args);
				}
			}
		},

		connect(callback) {
			return event.connectServer(callback);
		},

		predict(player, ...args) {
			event.invoke(player, ...args);
		},
	};

	setmetatable(method, {
		__call: (method, player, ...args) => {
			method.fire(player as Player, ...args);
		},
	});

	return method;
}
