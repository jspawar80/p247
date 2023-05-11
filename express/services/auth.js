const { Router } = require("express");
const jwt = require("jsonwebtoken");
const sendPasswordResetLink = require("./sendPasswordResetLink.js");
const model = require("../mongo/mongo.js");
const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const auth = Router();

const collection = model.collection("users");
const permissions = model.collection("permissions");

auth
  .post("/forgotpassword", async (req, res, next) => {
    console.log(req.body);
    try {
      const user = await collection.findOne({
        email: req.body.email.toLowerCase(),
      });
      if (!user) {
        res.status(400).json({ message: "no such user" });
        return;
      }
      if (!user.active) {
        res.status(200).json({ message: "user is not activated" });
        return;
      }
      sendPasswordResetLink(user._id.toString(), req.headers.origin);
      res.status(200).json({
        message: "check mail for furhter password reset instructions",
      });
    } catch (error) {
      console.log(error);
      res.status(400).json({ message: "no such user" });
    }
  })
  .post("/confirmpassword", async (req, res, next) => {
    try {
      const token = req.query._token;
      jwt.verify(token, process.env.EMAIL_SECRET, async (err, { _id }) => {
        if (err) {
          res.status(401).json({ message: "not authenticated" });
          next(new Error("not authenticated"));
        } else {
          if (!req.body.password) {
            res.status(400);
            return;
          }
          const result = await collection.updateOne(
            { _id: ObjectId(_id) },
            {
              $set: {
                password: await bcrypt.hash(req.body.password, 10),
              },
            }
          );
          res.status(200).json({ result });
        }
      });
    } catch (error) {
      console.log(error);
      res.status(400);
    }
  })
  .post("/register", async (req, res, next) => {
    try {
      if (!req.body) {
        res.status(400);
        return;
      }
      const result = await collection.insertOne({
        ...req.body,
        role: "admin",
        active: false,
      });
      if (result.acknowledged) {
        res.status(200).json({ result });
        sendPasswordResetLink(result.insertedId.toString());
      }
    } catch (error) {
      res.status(400);
    }
  })
  .post("/login", async (req, res) => {
    try {
      const user = await collection.findOne({
        email: req.body.email.toLowerCase(),
      });

      if (!user) {
        res.status(400).json({ message: "no such user" });
        return;
      }
      if (!user.active) {
        res.status(200).json({ message: "user is not activated" });
        return;
      }
      const authenticated = await bcrypt.compare(
        req.body.password,
        user.password
      );
      if (authenticated) {
        const token = jwt.sign(
          { id: user._id, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: "2days" }
        );

        res.status(200).json({
          User: {
            id: user._id,
            email: user.email,
            name: user.name,
            gender: user.gender,
            dob: user.dob,
            phoneNumber: user.phoneNumber,
            role: user.role,
            parentID: user.parentID,
          },
          _token: token,
        });
      } else {
        res.status(401).json({ message: "wrong credentials" });
      }
    } catch (error) {
      console.log(error);
      res.status(400).json({ message: "no such user" });
    }
  })
  .get("/logout", async (req, res) => {
    try {
      res.clearCookie("_token");
      res.status(200).end();
    } catch (error) {
      console.log(error);
      res.status(400).json({ message: "no such user" });
    }
  });

module.exports = auth;
