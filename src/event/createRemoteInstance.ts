import { ReplicatedStorage, RunService } from "@rbxts/services";

function findByAttribute(parent: Instance, id: string) {
	for (const child of parent.GetChildren()) {
		if (child.GetAttribute("id") === id) {
			return child;
		}
	}
}

function waitByAttribute(parent: Instance, id: string) {
	let instance = findByAttribute(parent, id);

	const watcherThread = task.delay(5, () => {
		warn(`Flamework is waiting on '${id}' for`, parent);
	});

	if (!instance) {
		while (true) {
			instance = parent.ChildAdded.Wait()[0];

			if (instance.GetAttribute("id") === id) {
				break;
			}
		}
	}

	task.cancel(watcherThread);

	return instance;
}

export function createRemoteInstance<T extends "RemoteEvent" | "UnreliableRemoteEvent">(
	remoteType: T,
	namespace: string,
	debugName: string,
	id: string,
) {
	if (!RunService.IsRunning()) {
		return new Instance(remoteType);
	}

	let namespaceFolder = RunService.IsServer()
		? findByAttribute(ReplicatedStorage, namespace)
		: waitByAttribute(ReplicatedStorage, namespace);

	if (!namespaceFolder) {
		namespaceFolder = new Instance("Folder");
		namespaceFolder.Name = namespace;
		namespaceFolder.SetAttribute("id", namespace);
		namespaceFolder.Parent = ReplicatedStorage;
	}

	let existingInstance = RunService.IsServer()
		? findByAttribute(namespaceFolder, id)
		: waitByAttribute(namespaceFolder, id);

	if (!existingInstance) {
		existingInstance = new Instance(remoteType);
		existingInstance.Name = debugName;
		existingInstance.SetAttribute("id", id);
		existingInstance.Parent = namespaceFolder;
	}

	assert(existingInstance.IsA(remoteType));
	return existingInstance;
}
