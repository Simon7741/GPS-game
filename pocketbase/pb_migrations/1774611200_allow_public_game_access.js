/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const gamesCollection = app.findCollectionByNameOrId("pbc_879072730")
  const pointsCollection = app.findCollectionByNameOrId("pbc_279573351")

  // Allow public access to list and view active games
  gamesCollection.listRule = "active = true"
  gamesCollection.viewRule = "active = true"

  // Allow public access to points belonging to active games
  pointsCollection.listRule = "game.active = true"
  pointsCollection.viewRule = "game.active = true"

  app.save(gamesCollection)
  app.save(pointsCollection)
}, (app) => {
  const gamesCollection = app.findCollectionByNameOrId("pbc_879072730")
  const pointsCollection = app.findCollectionByNameOrId("pbc_279573351")

  // Revert to requiring authentication
  gamesCollection.listRule = "@request.auth.id != ''"
  gamesCollection.viewRule = "@request.auth.id != ''"
  pointsCollection.listRule = "@request.auth.id != ''"
  pointsCollection.viewRule = "@request.auth.id != ''"

  app.save(gamesCollection)
  app.save(pointsCollection)
})
