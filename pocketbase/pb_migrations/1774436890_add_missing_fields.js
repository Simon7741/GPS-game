/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const games = app.findCollectionByNameOrId("pbc_879072730")
  const points = app.findCollectionByNameOrId("pbc_279573351")

  // Helper to add field if it doesn't exist
  const addFieldIfMissing = (collection, fieldConfig) => {
    try {
      collection.fields.getByName(fieldConfig.name)
    } catch (e) {
      collection.fields.add(new Field(fieldConfig))
    }
  }

  // Update games: add navigationType
  addFieldIfMissing(games, {
    "name": "navigationType",
    "type": "select",
    "values": ["map", "distance"],
    "maxSelect": 1,
    "required": false
  })

  // Update points: add fields
  addFieldIfMissing(points, {
    "name": "name",
    "type": "text"
  })
  addFieldIfMissing(points, {
    "name": "code",
    "type": "text"
  })
  addFieldIfMissing(points, {
    "name": "hint",
    "type": "text"
  })
  addFieldIfMissing(points, {
    "name": "hideDistance",
    "type": "bool"
  })

  // Update existing 'type' select field in points to include 'text_map'
  const typeField = points.fields.getByName("type")
  if (typeField) {
    const values = new Set(typeField.values || [])
    values.add("text")
    values.add("image")
    values.add("text_map")
    typeField.values = Array.from(values)
  }

  app.save(games)
  app.save(points)
}, (app) => {
  // Omit down migration for simplicity in this fix
})
