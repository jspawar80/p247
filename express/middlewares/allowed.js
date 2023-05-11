const model = require("../mongo/mongo.js");

const actions = {
  POST: "create",
  GET: "read",
  PUT: "update",
  DELETE: "delete",
};

const paths = {
  "/": "/",
  "/audit": "audit",
  "/filter": "filter",
  "/list": "list",
  "/aggregation": "aggregation",
};

const collection = model.collection("masterRights");

module.exports = (service) => {
  return async (req, res, next) => {
    const permissions = await collection.findOne({ role: req.user.role });
    const action = actions[req.method];
    const path = paths[req.path];
    console.log(req.path);
    if (permissions[service]) {
      if (path === "/") {
        if (permissions[service][action]) {
          next();
        } else {
          next(new Error("you don't have sufficient permission"));
        }
      } else {
        if (permissions[service][path]) {
          next();
        } else {
          next(new Error("you don't have sufficient permission"));
        }
      }
    } else {
      next(new Error("you don't have sufficient permission"));
    }
  };
};
