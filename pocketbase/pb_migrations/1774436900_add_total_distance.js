/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const games = app.findCollectionByNameOrId("pbc_879072730")

  // Update games: add totalDistance
  games.fields.add(new Field({
    "hidden": false,
    "id": "number_total_dist",
    "name": "totalDistance",
    "type": "number",
    "min": 0
  }))

  app.save(games)
}, (app) => {
  const games = app.findCollectionByNameOrId("pbc_879072730")
  games.fields.removeByName("totalDistance")
  app.save(games)
})
