const { Router } = require("express");
const model = require("../mongo/mongo.js");

const route = Router();

route.use(jwtMiddlware);
//TODO: implement role based notification permission here

const collection = model.collection("manageNotification");

route.use("/notification").get(async (req, res) => {
  const doucment = await collection.find();
});
