(async function () {
  const mongo = require("./mongo");

  const properties = mongo.collection("properties");
  const leads = mongo.collection("leads");
  const propertiesIDS = await properties.distinct("_id");
  const leadsIDS = await leads.distinct("_id");

  properties
    .updateMany(
      { sectorNumber: "SC-2" },
      { $set: { sectorNumber: "South City - 2" } }
    )
    .then(() => console.log("Done"));
})();
