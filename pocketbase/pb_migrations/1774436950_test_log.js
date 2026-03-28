/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  console.log("RUNNING MIGRATION: Checking navigationType field...");
  const games = app.findCollectionByNameOrId("pbc_879072730");
  
  try {
    games.fields.getByName("navigationType");
    console.log("navigationType field already exists.");
  } catch (e) {
    console.log("navigationType field missing, adding it now...");
    games.fields.add(new Field({
      "name": "navigationType",
      "type": "select",
      "values": ["map", "distance"],
      "maxSelect": 1,
      "required": false
    }));
    app.save(games);
    console.log("navigationType field added successfully.");
  }
}, (app) => {
})
