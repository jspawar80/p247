const { ObjectId } = require("mongodb");
const mongo = require("../mongo/mongo.js");
const jwt = require("jsonwebtoken");

const userCollection = mongo.collection("users");

module.exports = async (req, res, next) => {
  jwt.verify(
    req.headers["authorization"],
    process.env.JWT_SECRET,
    async (err, user) => {
      if (err) {
        res.status(401).json({ message: "not authenticated" });
        // next(new Error("not authenticated"));
      } else {
        const requestedUser = await userCollection.findOne(
          { _id: ObjectId(user.id) },
          { projection: { name: 1, id: 1, role: 1, parentID: 1 } }
        );
        req.user = requestedUser;
        const uid = requestedUser["id"];
        if (req.user !== null) {
          req.user.id = requestedUser._id.toString();
          req.user.uid = uid;
        } else {
          res.status(401).json({ message: "not authenticated" });
          // next(new Error("not authenticated"));
          return;
        }
        next();
      }
    }
  );
};
