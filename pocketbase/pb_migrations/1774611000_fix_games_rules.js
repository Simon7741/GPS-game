/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_879072730")

  // Update collection rules to correctly handle multi-relation owner field
  // and ensure listRule is set to allow verified creators to see their games
  unmarshal({
    "deleteRule": "owner ?~ @request.auth.id",
    "updateRule": "owner ?~ @request.auth.id",
    "listRule": "@request.auth.id != ''" // Allow all authenticated users to list (UI will filter)
  }, collection)

  // Update owner field to be single-select if preferred, but for now we keep 999 
  // to avoid breaking changes, but fix the rule to be more robust.

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_879072730")

  unmarshal({
    "deleteRule": "owner = @request.auth.id",
    "updateRule": "owner = @request.auth.id",
    "listRule": ""
  }, collection)

  return app.save(collection)
})
