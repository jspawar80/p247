const { ObjectId } = require("mongodb");
const mongo = require("../../mongo/mongo");

const propertiesCollection = mongo.collection("properties");
const usersCollection = mongo.collection("users");

module.exports = async function (id) {
  const { createdBy, ...property } = await propertiesCollection.findOne({
    _id: ObjectId(id),
  });
  // const user = await usersCollection.findOne({ _id: ObjectId(createdBy) });
  return {
    ...property,
    createdBy: "admin",
  };
};
