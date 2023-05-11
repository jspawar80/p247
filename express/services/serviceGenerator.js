const { Worker } = require("worker_threads");
const path = require("path");
const { Router } = require("express");
const { ObjectId } = require("mongodb");
const multer = require("multer");
const csv = require("csvtojson");
const model = require("../mongo/mongo.js");
const jwt = require("../middlewares/jwt.js");
const rights = require("../middlewares/allowed");
const audit = require("./audit");
const Ajv = require("ajv");
const { send } = require("process");
const ajv = new Ajv();

//all callbacks routes and callfores routes expects some async promise based function which accpets req and res objects to work on
function microservicesGenerator({
  collectionName,
  actions,
  actionCalls,
  validationSchema,
  afterValidationCommand,
}) {
  const route = Router();
  const upload = multer();
  const collection = model.collection(collectionName);

  //use for authetication
  route.use(jwt);
  const microserviceRoute = route.route("/").all(jwt);

  if (actions.includes("ids")) {
    route.route("/ids").post(async (req, res) => {
      try {
        const readCalls = actionCalls?.read;
        if (readCalls?.fore) {
          await readCalls?.fore({ req, res });
        }
        const ids = req.body.map((id) => ObjectId(id));
        const result = await collection
          .aggregate([
            {
              $match: {
                _id: { $in: ids },
              },
            },
          ])
          .toArray();
        res.status(200).json({ collectionName, result });
        if (readCalls?.back) {
          await readCalls?.back({ result });
        }
      } catch (error) {
        res.status(400).send(error);
      }
    });
  }

  if (actions.includes("read")) {
    microserviceRoute.get(async (req, res) => {
      try {
        const readCalls = actionCalls?.read;
        if (readCalls?.fore) {
          await readCalls?.fore({ req, res });
        }
        const result = await collection.findOne({
          _id: ObjectId(req.query._id),
        });
        res.status(200).json({ collectionName, result });
        if (readCalls?.back) {
          await readCalls?.back({ result });
        }
      } catch (error) {
        res.status(400).send(error);
      }
    });
  }

  if (actions.includes("insert")) {
    microserviceRoute.post(async (req, res, next) => {
      try {
        if (req.body.action !== "insert") {
          next();
          return;
        }
        const insertCalls = actionCalls?.insert;
        if (insertCalls?.fore) {
          await insertCalls?.fore({ req, res });
        }
        const document = req.body;
        let response;
        const result = await collection.insertOne(req.body);
        response = result;
        if (insertCalls?.back) {
          result._id = req.user.id;
          response = await insertCalls?.back({ result });
        } else {
          response = await collection.findOne({ _id: result.insertedId });
        }
        res.status(200).json({ result: response });
      } catch (error) {
        console.log(error);
        res.status(400).send(error);
      }
    });
  }

  if (actions.includes("update")) {
    microserviceRoute.put(async (req, res) => {
      try {
        const updateCalls = actionCalls?.update;
        if (updateCalls?.fore) {
          await updateCalls?.fore({ req, res });
        }
        const { _id, ...document } = req.body;
        let response;
        if (req.skipMain) {
          res.status(200).json(req.body);
          return;
        }
        if (!_id) {
          const result = await collection.insertOne(document);
          result.updatedId = result.insertedId;
          response = result;
        }
        if (_id) {
          console.log({ _id });
          const result = await collection.updateOne(
            { _id: ObjectId(_id) },
            { $set: document },
            {
              upsert: true,
            }
          );
          result.updatedId = _id;
          response = result;
        }
        if (updateCalls?.back) {
          const backResult = await updateCalls?.back({
            result: response,
            req,
          });
          if (backResult) response = backResult;
        }
        res.status(200).json({
          collectionName: response.collectionName || collectionName,
          result: response,
        });
      } catch (error) {
        console.log(error);
        res.status(400).send(error);
      }
    });
  }

  if (actions.includes("remove")) {
    microserviceRoute.delete(async (req, res) => {
      try {
        const removeCalls = actionCalls?.remove;
        let response;
        if (removeCalls?.fore) {
          await removeCalls?.fore({ req, res });
        }
        const result = await collection.findOneAndDelete({
          _id: ObjectId(req.query._id),
        });
        response = result;
        if (removeCalls?.back) {
          const backResult = await removeCalls?.back({
            result: {
              ...result,
              removedId: req.query._id,
            },
          });
          if (backResult) response = backResult;
        }
        res.status(200).json({
          collectionName: response.collectionName || collectionName,
          result: response,
        });
      } catch (error) {
        console.log(error);
        res.status(400).send(error);
      }
    });
  }

  if (actions.includes("filter")) {
    microserviceRoute.post(async (req, res, next) => {
      try {
        if (req.body.action !== "filter") {
          next();
          return;
        }
        const filterCalls = actionCalls?.filter;
        //TODO: implement relational permissions here
        if (filterCalls?.fore) {
          await filterCalls?.fore({ req, res });
        }
        const result = {};
        if (req.skip) {
          res.status(200).json(req.body);
          return;
        }
        result.documents = await collection
          .aggregate(req.body.pipeline)
          .toArray();
        console.log({ result });
        if (req.attachments) {
          result.attachments = req.attachments;
        }
        // if (filterCalls?.back) {
        //   const newResult = await filterCalls?.back({
        //     result,
        //     user: req.user,
        //   });
        //   if (newResult) result.documents = newResult;
        // }
        res.status(200).json({ collectionName, result });
      } catch (error) {
        console.log(error);
        res.status(400).send(error);
      }
    });
  }

  if (actions.includes("upload")) {
    route.route("/upload").post(upload.single("file"), async (req, res) => {
      try {
        const uploadCalls = actionCalls?.upload;
        //TODO: implement relational permissions here
        if (uploadCalls?.fore) {
          await uploadCalls?.fore({ req, res });
        }
        csv()
          .fromString(req.file.buffer.toString("utf8"))
          .then(async (data) => {
            res.status(200).send();
            //creating new worker thread for upload verification and all upload
            const uploadWorker = new Worker(
              path.join(__dirname, "./upload.js"),
              {
                workerData: {
                  documents: data,
                  collectionName,
                  validationSchema,
                  //callback at document level verification it accepts some
                  afterValidationCommand,
                },
              }
            );
            uploadWorker.on("message", (result) => {
              if (uploadCalls?.back) {
                console.log(result);
                uploadCalls?.back({ result });
              }
            });
          });
      } catch (error) {
        console.log(error);
        res.status(400).send(error);
      }
    });
  }

  return route;
}

module.exports = microservicesGenerator;
