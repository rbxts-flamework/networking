export type Skip = { _nominal_Skip: never };
export const Skip = {
	__index: () => undefined,
	__newindex: () => undefined,
	__tostring: () => `Networking.Skip`,
} as LuaMetatable<Skip> as Skip;
setmetatable(Skip, Skip as LuaMetatable<Skip>);

// This is a special skip type used to instruct Flamework to reject with a value of "BadRequest"
// This does affect equality, though, so it can only be returned from the very first middleware
// to avoid other middleware from being able to inspect it.
export type SkipBadRequest = Skip & { _nominal_SkipBadRequest: never };
export const SkipBadRequest = {} as SkipBadRequest;
setmetatable(SkipBadRequest, Skip as LuaMetatable<SkipBadRequest>);
