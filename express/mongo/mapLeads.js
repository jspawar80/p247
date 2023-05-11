const mongo = require("./mongo");

const propertiesCollection = mongo.collection("properties");
const authorityCollection = mongo.collection("authority");
const mapsCollection = mongo.collection("maps");
const usersCollection = mongo.collection("users");
const leadsCollection = mongo.collection("leads");
const searchesCollection = mongo.collection("searches");
// const leadsIDS = await leadsCollection.aggregate().toArray();
// const propertiesIDS = await propertiesCollection.aggregate().toArray();
// const propertiesIDS = await searchesCollection.aggregate().toArray();category

searchesCollection.deleteMany({}).then(() => {});
// authorityCollection.deleteMany({}).then(() => {});
// mapsCollection.deleteMany({}).then(() => {});

return;

propertiesCollection.updateMany(
  {
    sectorNumber: "GreenwoodCity",
  },
  {
    $set: {
      state: "HARYANA",
      city: "GURUGRAM",
      category: "PLOT",
    },
  }
);
