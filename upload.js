const csv = require("csvtojson");
const { faker } = require("@faker-js/faker");
const mongo = require("./express/mongo/mongo.js");
const idGenerator = require("./express/services/idGenerator.js");

const updated = [];

csv()
  .fromFile("./data.csv")
  .then((documents) => {
    documents.forEach((document) => {
      document["id"] = idGenerator(document);
      document["owner"] = faker.name.fullName();
      updated.push(document);
    });
  });

mongo
  .collection("properties")
  .insertMany(updated)
  .then((result) => console.log(result));
