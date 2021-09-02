export type Skip = { _nominal_Skip: never };
export const Skip = {
	__index: () => undefined,
	__newindex: () => undefined,
	__tostring: () => `Networking.Skip`,
} as LuaMetatable<Skip> as Skip;
setmetatable(Skip, Skip as LuaMetatable<Skip>);
