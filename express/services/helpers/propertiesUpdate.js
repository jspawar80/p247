const { ObjectId } = require("mongodb");
const mongo = require("../../mongo/mongo");
const idGenerator = require("../idGenerator");

const modResult = async (id, req) => {
  const propertiesCollection = mongo.collection("properties");
  const userCollection = mongo.collection("users");
  const property = await propertiesCollection
    .aggregate([
      {
        $match: { _id: ObjectId(id) },
      },
      {
        $lookup: {
          from: "authority",
          let: {
            propertyID: "$_id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$propertyID", "$$propertyID"],
                },
              },
            },
          ],
          as: "authority",
        },
      },
      {
        $lookup: {
          from: "maps",
          let: {
            propertyID: "$_id",
          },
          pipeline: [
            // {
            //   $match: {
            //     ...req.body.pipeline.maps,
            //   },
            // },
            {
              $match: {
                $expr: {
                  $eq: ["$propertyID", "$$propertyID"],
                },
              },
            },
          ],
          as: "maps",
        },
      },
      {
        $lookup: {
          from: "leads",
          let: { propertyID: { $toString: "$_id" } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$createdByID", [req.user.parent?.id, req.user.id]],
                },
              },
            },
            {
              $lookup: {
                from: "tags",
                let: { leadID: { $toString: "$_id" } },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$typeToId", "$$leadID"] },
                    },
                  },
                  {
                    $match: {
                      $expr: { $eq: ["$typeFormId", req.user.id] },
                    },
                  },
                  {
                    $project: { name: 1 },
                  },
                ],
                as: "isTagged",
              },
            },
            req.user.role === "salesUser"
              ? {
                  $match: {
                    $expr: {
                      $ne: ["$createdByID", req.user.id.toString()],
                    },
                  },
                }
              : { $match: {} },
            { $match: { $expr: { $eq: ["$pid", "$$propertyID"] } } },
            req.user.role === "salesUser"
              ? {
                  $project: {
                    queryFrom: 1,
                    createdByID: 1,
                    pid: 1,
                    date: 1,
                  },
                }
              : {
                  $project: {
                    lid: 0,
                  },
                },
            {
              $project: {
                cheque: { $toUpper: "$cheque" },
                builtup: { $toUpper: "$builtup" },
                status: { $toUpper: "$status" },
                interested: { $toUpper: "$interested" },
                file: { $toUpper: "$file" },
                comments: 1,
                queryFrom: 1,
                date: 1,
                lid: 1,
                pid: 1,
                demand: 1,
                offer: 1,
                salesPerson: 1,
                customer: 1,
                salesUser: 1,
                output: 1,
                userName: 1,
                customerName: 1,
                customerContact: 1,
                createdBy: 1,
                salesUserName: 1,
                salesUserContact: 1,
                isTagged: 1,
                createdOn: 1,
              },
            },
          ],
          as: "output",
        },
      },

      //creted by salesUser
      // user.role === "salesUser"
      //   ? {
      //       $lookup: {
      //         from: "leads",
      //         let: { propertyID: { $toString: "$_id" } },
      //         pipeline: [
      //           {
      //             $match: {
      //               $expr: {
      //                 $in: ["$createdBy", allowed[user.role]],
      //               },
      //             },
      //           },
      //           {
      //             $match: {
      //               $expr: {
      //                 $eq: ["$createdByID", user._id.toString()],
      //               },
      //             },
      //           },
      //           {
      //             $match: { $expr: { $eq: ["$pid", "$$propertyID"] } },
      //           },
      //           {
      //             $lookup: {
      //               from: "users",
      //               let: {
      //                 cid: { $toObjectId: "$cid" },
      //               },
      //               pipeline: [
      //                 {
      //                   $match: {
      //                     $expr: { $eq: ["$_id", "$$cid"] },
      //                   },
      //                 },
      //                 {
      //                   $project: { name: 1, contact: 1 },
      //                 },
      //               ],
      //               as: "output.customer",
      //             },
      //           },
      //           {
      //             $lookup: {
      //               from: "users",
      //               let: {
      //                 suid: { $toObjectId: "$suid" },
      //               },
      //               pipeline: [
      //                 {
      //                   $match: {
      //                     $expr: { $eq: ["$_id", "$$suid"] },
      //                   },
      //                 },
      //                 {
      //                   $project: { name: 1, contact: 1 },
      //                 },
      //               ],
      //               as: "output.salesUser",
      //             },
      //           },
      //           {
      //             $lookup: {
      //               from: "users",
      //               let: {
      //                 createdByID: { $toObjectId: "$createdByID" },
      //               },
      //               pipeline: [
      //                 {
      //                   $match: {
      //                     $expr: { $eq: ["$_id", "$$createdByID"] },
      //                   },
      //                 },
      //                 {
      //                   $project: { name: 1 },
      //                 },
      //               ],
      //               as: "userName.createdBy",
      //             },
      //           },
      //         ],
      //         as: "cdoutput",
      //       },
      //     }
      //   : { $match: {} },
    ])
    .toArray();
  // console.log({ property });
  return property;
};

module.exports = async function ({ req, res }) {
  try {
    const reqRole = req.user.role;
    const userID = req.user.id;
    const parentID = req.user.parent?.id;
    const {
      _id,
      propertyID,
      action,
      sectorNumber,
      plotNumber,
      category,
      ...updates
    } = req.body;

    const collection = mongo.collection("authority");
    const authority = await collection.findOne({ _id: ObjectId(_id) });
    if (authority) {
      if (
        authority.createdByID === userID ||
        authority.createdByID === parentID
      ) {
        console.log("updateRole match");
        const result = await collection.updateOne(
          { _id: ObjectId(_id) },
          { $set: updates },
          {
            upsert: true,
          }
        );
        req.skipMain = true;
        req.body = {
          collectionName: "properties",
          result: await modResult(propertyID, req),
        };
        return;
      } else {
        console.log("updateRole not match");
        const authority = await collection.insertOne({
          ...updates,
          propertyID: ObjectId(propertyID),
          createdOn: new Date(),
          createdByID: parentID ?? userID,
        });
        req.skipMain = true;
        req.body = {
          collectionName: "properties",
          result: await modResult(propertyID, req),
        };
      }
    }
    if (propertyID) {
      const result = await collection.updateOne(
        { propertyID: propertyID, createdByID: parentID ?? userID },
        {
          ...updates,
          propertyID: propertyID,
          createdOn: new Date(),
          createdByID: parentID ?? userID,
        },
        {
          upsert: true,
        }
      );
      if (result.acknowledged) {
        req.skipMain = true;
        req.body = {
          collectionName: "properties",
          result: await modResult(propertyID, req),
        };
      }
      return;
    } else {
      if (!category || !sectorNumber || !plotNumber) {
        return res.status(400).send({ message: "Invalid request" });
      }
      const propertiesCollection = mongo.collection("properties");
      const propertiesResult = await propertiesCollection.insertOne({
        ...idGenerator({
          category,
          sectorNumber,
          plotNumber,
          state: "haryana",
          city: "gurugram",
        }),
        createdBy: req.user.id,
      });
      const authority = await collection.insertOne({
        ...updates,
        propertyID: propertiesResult.insertedId.toString(),
        createdOn: new Date(),
        createdByID: req.user.id,
      });
      if (authority.acknowledged) {
        req.skipMain = true;
        req.body = {
          collectionName: "properties",
          result: await modResult(propertiesResult.insertedId, req),
        };
      }
    }
  } catch (error) {
    console.log(error);
  }
};
