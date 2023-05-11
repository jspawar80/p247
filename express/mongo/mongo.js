const { MongoClient } = require("mongodb");
const random = require("../constants/random.js");
const client = new MongoClient(random.MONGO_URI);
module.exports = client.db("model");
