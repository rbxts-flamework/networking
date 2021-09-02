import { ReplicatedStorage, RunService } from "@rbxts/services";

export function populateInstanceMap<T extends "RemoteEvent" | "RemoteFunction">(
	className: T,
	globalName: string,
	names: string[],
	map: Map<string, CreatableInstances[T]>,
) {
	let remotes = RunService.IsServer()
		? ReplicatedStorage.FindFirstChild(globalName)
		: ReplicatedStorage.WaitForChild(globalName);

	if (!remotes) {
		remotes = new Instance("Folder");
		remotes.Name = globalName;
		remotes.Parent = ReplicatedStorage;
	}

	for (const name of names) {
		if (RunService.IsClient()) {
			const instance = remotes.WaitForChild(name);
			if (instance.IsA(className)) {
				map.set(name, instance);
			}
		} else {
			const instance = remotes.FindFirstChild(name);

			if (instance) {
				if (!instance.IsA(className)) throw `Found ${name} but it is not a remote.`;
				map.set(name, instance);
			} else {
				const remote = new Instance(className);
				remote.Name = name;
				remote.Parent = remotes;
				map.set(name, remote);
			}
		}
	}
}
