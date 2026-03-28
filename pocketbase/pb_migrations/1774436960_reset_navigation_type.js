/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const games = app.findCollectionByNameOrId("pbc_879072730");

  console.log("Removing navigationType field if exists...");
  try {
    const field = games.fields.getByName("navigationType");
    if (field) {
        games.fields.removeByName("navigationType");
        app.save(games);
        console.log("Existing navigationType field removed.");
    }
  } catch (e) {
    console.log("navigationType field did not exist or could not be removed.");
  }

  console.log("Adding navigationType field fresh...");
  games.fields.add(new Field({
    "name": "navigationType",
    "type": "select",
    "values": ["map", "distance"],
    "maxSelect": 1,
    "required": false
  }));

  app.save(games);
  console.log("navigationType field re-added successfully.");
}, (app) => {
})
