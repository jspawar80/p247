const { Router } = require("express");
const { ObjectId } = require("mongodb");
const multer = require("multer");
const model = require("../mongo/mongo.js");
const jwtMiddlware = require("../middlewares/jwt.js");
const permissions = require("../middlewares/allowed");

const service = "audits";

const route = Router();
const upload = multer();
const collection = model.collection(service);

// route.use(jwtMiddlware);
// route.use(permissions(service));

route.route("/filter").post(async (req, res) => {
  try {
    //TODO: implement relational permissions here
    const result = await collection.aggregate(req.body).toArray();
    res.status(200).json({ service, result });
    if (callbacks) {
      if (callbacks["filter"]) {
        callbacks["filter"]({ content: req.body, user: req.user });
      }
    }
  } catch (error) {
    console.log(error);
    res.status(301).send("mongodb");
  }
});

module.exports = route;
