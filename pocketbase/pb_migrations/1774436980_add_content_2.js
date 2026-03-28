/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const points = app.findCollectionByNameOrId("pbc_279573351");

  const addField = (name, type, options = {}) => {
    try {
      points.fields.getByName(name);
      console.log(`Field '${name}' already exists.`);
    } catch (e) {
      console.log(`Adding field '${name}'...`);
      points.fields.add(new Field({
        name,
        type,
        ...options
      }));
    }
  };

  addField("content_2", "text");

  app.save(points);
  console.log("Points collection updated with content_2 field.");
}, (app) => {
})
