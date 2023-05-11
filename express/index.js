const express = require("express");
const cookie = require("cookie-parser");
const cors = require("cors");
const Ajv = require("ajv");
const path = require("path");
const ajv = new Ajv();
const mongo = require("./mongo/mongo");
const isLoggedInRoute = require("./services/isLoggedIn");
const microserviceGenerator = require("./services/serviceGenerator.js");
const authMicroservice = require("./services/auth.js");
const idGenerator = require("./services/idGenerator.js");
const fieldPermissions = require("./services/fieldPermissions");
const { propertiesSchema } = require("./middlewares/validator.js");
// const mail = require("./services/mail.js");
const app = express();
const sendPasswordResetLink = require("./services/sendPasswordResetLink");
const { ObjectId } = require("mongodb");
//! TODO fix image upload
const propertiesUpdate = require("./services/helpers/propertiesUpdate.js");
const filterPropertiesCBID = require("./services/helpers/filterPropertiesCBID.js");
const getMaster = require("./services/getMaster.js");
const master = require("../master");
const multer = require("multer");
const { Console } = require("console");
const jwt = require("./middlewares/jwt");
const allowed = require("./middlewares/allowed");
const { pipeline } = require("stream");
const uploadtos3 = require("./shared/uploadtos3");
const {
  get_data_masters,
  get_user_groups,
  get_crud_permissions,
  get_field_permissions,
} = require("./config.js");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./upload/");
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}.${file.originalname.split(".")[1]}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage,
});

const corsOptions = {
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "X-Access-Token",
    "Authorization",
  ],
  credentials: true,
  methods: "GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE",
  origin: true,
  preflightContinue: false,
};

app.use(cors(corsOptions));
app.use(cookie());
app.use(express.json({}));
app.use(express.query());

let cahce = [];

app.get("/datamasters", async (req, res) => {
  try {
    const { query } = req;
    if (query.key !== "cBrvgRgz770FmcBH3vbsfmmT0qyFuNtd") {
      res.status(400).json({ error: "Not Authorized" });
    }
    const collection = mongo.collection("masterManagement");
    const data = await get_data_masters();
    if (data?.length > 0) {
      collection.deleteMany({});
      collection.insertMany(data);
    }
    res.status(200).json({ message: "Updated Data Masters" });
  } catch (error) {
    res.status(500).json({ error });
  }
});

app.get("/usergroups", async (req, res) => {
  try {
    const { query } = req;
    if (query.key !== "cBrvgRgz770FmcBH3vbsfmmT0qyFuNtd") {
      res.status(400).json({ error: "Not Authorized" });
    }
    const collection = mongo.collection("usergroups");
    const data = await get_user_groups();
    console.log(data);
    data.shift();
    if (data?.length > 0) {
      collection.deleteMany({});
      collection.insertMany(data);
    }
    res.status(200).json({ message: "Updated User Groups" });
  } catch (error) {
    res.status(500).json({ error });
  }
});

app.get("/crudpermissions", async (req, res) => {
  try {
    const { query } = req;
    if (query.key !== "cBrvgRgz770FmcBH3vbsfmmT0qyFuNtd") {
      res.status(400).json({ error: "Not Authorized" });
    }
    const collection = mongo.collection("crudpermissions");
    const data = await get_crud_permissions();
    data.shift();
    if (data?.length > 0) {
      collection.deleteMany({});
      collection.insertMany(data);
    }
    res.status(200).json({ message: "Updated CRUD Permissions" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

app.get("/fieldpermissions", async (req, res) => {
  try {
    const { query } = req;
    if (query.key !== "cBrvgRgz770FmcBH3vbsfmmT0qyFuNtd") {
      res.status(400).json({ error: "Not Authorized" });
    }
    const collection = mongo.collection("fieldpermissions");
    const data = await get_field_permissions();
    data.shift();
    if (data?.length > 0) {
      collection.deleteMany({});
      collection.insertMany(data);
    }
    res.status(200).json({ message: "Updated Field Permissions" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
});

app.post("/list/sectors", async (req, res) => {
  const sectorNumbers = await mongo
    .collection("properties")
    .distinct("sectorNumber", { category: "PLOT" });
  if (cahce.length > 1) {
    console.log({ cahce });
    res.status(200).send(cahce);
    return;
  }
  const result = await Promise.all(
    sectorNumbers.map(async (sectorNumber) => {
      const documents = await mongo
        .collection("properties")
        .aggregate([
          {
            $match: {
              sectorNumber: { $eq: sectorNumber },
            },
          },
          {
            $lookup: {
              from: "maps",
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
                {
                  $project: {
                    _id: 0,
                    roadWidth: 1,
                    size: 1,
                  },
                },
              ],
              as: "maps",
            },
          },
          {
            $project: {
              _id: 0,
              plotNumber: 1,
              maps: 1,
            },
          },
        ])
        .toArray();
      const plotNumbers = documents.map((document) => document?.plotNumber);
      const roadWidths = documents.map(
        (document, index) => document?.maps[0]?.roadWidth
      );
      const sizes = documents.map((document, index) => document?.maps[0]?.size);

      return {
        plotNumbers,
        sectorNumber,
        roadWidths,
        sizes,
      };
    })
  );
  cahce = result;
  res.status(200).send(result);
});

let mapCache = null;

app.post("/list/projects", async (req, res) => {
  if (mapCache) {
    res.status(200).send(mapCache);
    return;
  }
  const map = {};
  const validLocations = await mongo.collection("aparmtentsAuthority").distinct("location")
  const projectNames = await mongo
    .collection("properties")
    .find({ category: "apartment" })
    .toArray();
  await Promise.all(
    projectNames.map(async ({ projectName, sizes }) => {
      map[projectName] = sizes;
      const location = Object.keys(sizes ?? {})[0];
      if (validLocations.includes(`${projectName} ${location}`)) {
        const apartmentNumbers = await mongo
          .collection("aparmtentsAuthority")
          .aggregate([{ $match: { location: `${projectName} ${location}` } }])
          .toArray();
        map[projectName] = {
          ...map[projectName],
          apartmentNumbers:
            apartmentNumbers.map(({ apartmentNumber }) => apartmentNumber) ??
            [],
        };
      } else {
        map[projectName] = {
          ...map[projectName],
          apartmentNumbers: [],
        };
      }
    })
  );
  mapCache = map;
  res.status(200).send(map);
});

app.post("/auto", jwt, async (req, res) => {
  const { field, sectorNumbers } = req.body;
  let result = [];
  result = await mongo
    .collection("properties")
    .distinct(field, { sectorNumber: { $in: sectorNumbers } });
  res.status(200).send(result);
});

app.post("/updateMany", jwt, async (req, res) => {
  const { selected, collection, update } = req.body;
  const c = mongo.collection(collection);
  const selectedObjectIds = selected.map((selection) => ObjectId(selection));
  if (req.user.role !== "admin") {
    res.status(200).json({});
    return;
  }
  const result = await c.updateMany(
    { _id: { $in: selectedObjectIds } },
    { $set: update },
    {
      upsert: true,
    }
  );
});

app.post("/deleteMany", jwt, async (req, res) => {
  const { selected, collection } = req.body;
  const c = mongo.collection(collection);
  let selectedObjectIds = selected;
  let result;
  selectedObjectIds = selected.map((selection) => ObjectId(selection));
  if (collection === "properties") {
    result = await c.deleteMany({ _id: { $in: selectedObjectIds } });
  }
  if (collection === "leads") {
    result = await c.deleteMany({
      _id: { $in: selectedObjectIds },
      salesUserID: { $eq: req.user._id.toString() },
    });
  }
  res.status(200).json({ result });
});

app.post("/getMaps", async (req, res) => {
  const { sectorNumber } = req.body;
  const sectorMaps = mongo.collection("sectorMaps");
  const maps = await sectorMaps
    .aggregate([
      {
        $match: {
          sectorNumber: { $in: sectorNumber },
        },
      },
    ])
    .toArray();
  res.send(maps);
});

app.post("/uploadMap", upload.single("map"), async (req, res) => {
  const file = req.file;
  const { sectorNumber } = req.body;
  const sectorMaps = mongo.collection("sectorMaps");
  const result = await sectorMaps.insertOne({
    sectorNumber,
    mapName: file.filename,
  });
  if (result.acknowledged) {
    res.json({
      _id: result.insertedId,
      sectorNumber,
      mapName: file.filename,
    });
  }
});

app.use("/isLoggedIn", isLoggedInRoute);

app.use("/auth/microservice", authMicroservice);

app.use("/master", getMaster);

app.use(
  "/properties",
  microserviceGenerator({
    collectionName: "properties",
    actions: ["read", "insert", "update", "remove", "filter", "upload", "ids"],
    actionCalls: {
      update: {
        fore: propertiesUpdate,
        back: async ({ result, user }) => {
          const allowed = {
            admin: ["admin", "propertyDealer", "salesUser"],
            propertyDealer: ["propertyDealer", "salesUser"],
            salesUser: ["salesUser"],
          };
          const leadsColection = mongo.collection("leads");
          const propertiesCollection = mongo.collection("properties");
          const property = await propertiesCollection
            .aggregate([
              {
                $match: { _id: ObjectId(result.updatedId) },
              },
              {
                $lookup: {
                  from: "leads",
                  let: { propertyID: { $toString: "$_id" } },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $in: ["$createdBy", allowed[user.role]] },
                      },
                    },
                    user.role === "salesUser"
                      ? {
                        $match: {
                          $expr: {
                            $ne: ["$createdByID", user._id.toString()],
                          },
                        },
                      }
                      : { $match: {} },
                    { $match: { $expr: { $eq: ["$pid", "$$propertyID"] } } },
                    user.role === "salesUser"
                      ? {
                        $project: {
                          queryFrom: 1,
                          cid: 1,
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
                      $lookup: {
                        from: "users",
                        let: {
                          cid: { $toObjectId: "$cid" },
                        },
                        pipeline: [
                          {
                            $match: {
                              $expr: { $eq: ["$_id", "$$cid"] },
                            },
                          },
                          {
                            $project: { name: 1, contact: 1 },
                          },
                        ],
                        as: "output.customer",
                      },
                    },
                    {
                      $lookup: {
                        from: "users",
                        let: {
                          suid: { $toObjectId: "$suid" },
                        },
                        pipeline: [
                          {
                            $match: {
                              $expr: { $eq: ["$_id", "$$suid"] },
                            },
                          },
                          {
                            $project: { name: 1, contact: 1 },
                          },
                        ],
                        as: "output.salesUser",
                      },
                    },
                    {
                      $lookup: {
                        from: "users",
                        let: {
                          createdByID: { $toObjectId: "$createdByID" },
                        },
                        pipeline: [
                          {
                            $match: {
                              $expr: { $eq: ["$_id", "$$createdByID"] },
                            },
                          },
                          {
                            $project: { name: 1 },
                          },
                        ],
                        as: "userName.createdBy",
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
                        suid: 1,
                        cid: 1,
                        demand: 1,
                        offer: 1,
                        salesPerson: 1,
                        customer: 1,
                        salesUser: 1,
                        output: 1,
                        userName: 1,
                      },
                    },
                  ],
                  as: "output",
                },
              },
              //creted by salesUser
              user.role === "salesUser"
                ? {
                  $lookup: {
                    from: "leads",
                    let: { propertyID: { $toString: "$_id" } },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $in: ["$createdBy", allowed[user.role]],
                          },
                        },
                      },
                      {
                        $match: {
                          $expr: {
                            $eq: ["$createdByID", user._id.toString()],
                          },
                        },
                      },
                      {
                        $match: { $expr: { $eq: ["$pid", "$$propertyID"] } },
                      },
                      {
                        $lookup: {
                          from: "users",
                          let: {
                            cid: { $toObjectId: "$cid" },
                          },
                          pipeline: [
                            {
                              $match: {
                                $expr: { $eq: ["$_id", "$$cid"] },
                              },
                            },
                            {
                              $project: { name: 1, contact: 1 },
                            },
                          ],
                          as: "output.customer",
                        },
                      },
                      {
                        $lookup: {
                          from: "users",
                          let: {
                            suid: { $toObjectId: "$suid" },
                          },
                          pipeline: [
                            {
                              $match: {
                                $expr: { $eq: ["$_id", "$$suid"] },
                              },
                            },
                            {
                              $project: { name: 1, contact: 1 },
                            },
                          ],
                          as: "output.salesUser",
                        },
                      },
                      {
                        $lookup: {
                          from: "users",
                          let: {
                            createdByID: { $toObjectId: "$createdByID" },
                          },
                          pipeline: [
                            {
                              $match: {
                                $expr: { $eq: ["$_id", "$$createdByID"] },
                              },
                            },
                            {
                              $project: { name: 1 },
                            },
                          ],
                          as: "userName.createdBy",
                        },
                      },
                    ],
                    as: "cdoutput",
                  },
                }
                : { $match: {} },
            ])
            .toArray();
          return property;
        },
      },
      insert: {
        fore: async ({ req, res }) => {
          req.body.id = idGenerator(req.body).id;
          req.body.createdBy = req.user.role;
        },
        back: ({ result }) =>
          filterPropertiesCBID(result.insertedId.toString()),
      },
      filter: {
        fore: ({ req, res }) => {
          const allowed = {
            admin: ["admin", "propertyDealer", "salesUser"],
            propertyDealer: ["propertyDealer", "salesUser"],
            salesUser: ["salesUser"],
          };
          req.body.pipeline = [
            ...req.body.pipeline,
            {
              $match: { createdBy: { $in: [null, "admin"] } },
            },
          ];
        },
      },
    },
  })
);

app.post("/apartments/microservice", jwt, async function (req, res) {
  const condProj = {
    $or: [
      {
        $in: ["$salesUserID", [req.user._id.toString(), req.user.parentID]],
      },
      {
        $eq: ["admin", req.user.role],
      },
      {
        $eq: ["$createdByID", req.user._id.toString()],
      },
    ],
  };
  const apartmentNumber = req.body.pipeline.leads.apartmentNumber?.$eq;
  const projectName = req.body.pipeline.leads.projectName?.$eq;
  const location = req.body.pipeline.leads.location?.$eq;

  const needAuthority = apartmentNumber && projectName && location;

  const authority = await mongo.collection("aparmtentsAuthority").find({
    location: `${projectName} ${location}`,
    apartmentNumber
  }).toArray()

  const pipeline = [
    {
      $match: {
        ...req.body.pipeline.leads,
      },
    },

    req.user.role !== "admin"
      ? {
        $match: {
          $expr: {
            $or: [
              {
                $in: [
                  "$salesUserID",
                  [req.user._id.toString(), req.user.parentID],
                ],
              },
              {
                $eq: ["admin", req.user.role],
              },
              {
                $in: [
                  "$createdByID",
                  [req.user._id.toString(), req.user.parentID],
                ],
              },
            ],
          },
        },
      }
      : { $match: {} },
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
        ],
        as: "isTagged",
      },
    },
    {
      $lookup: {
        from: "users",
        let: {
          salesUserID: { $toObjectId: "$salesUserID" },
        },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$salesUserID"] },
            },
          },
          {
            $project: {
              _id: 0,
              name: 1,
            },
          },
        ],
        as: "createdBy",
      },
    },
    {
      $lookup: {
        from: "aparmtentsAuthority",
        let: {
          salesUserID: { $toObjectId: "$salesUserID" },
        },
        pipeline: [
          {
            $match: {
              $expr: { $and: [{ $eq: ["$apartmentNumber", apartmentNumber] }, { $eq: ["$location", `${projectName} ${location}`] }] },
            },
          },
        ],
        as: "authority",
      },
    },
    {
      $project: {
        cheque: 1,
        builtup: 1,
        status: 1,
        interested: 1,
        file: 1,
        comments: {
          $cond: {
            if: condProj,
            then: { $toUpper: "$comments" },
            else: "$$REMOVE",
          },
        },
        queryFrom: 1,
        date: 1,
        lid: 1,
        pid: 1,
        demand: 1,
        offer: 1,
        authority: 1,
        output: 1,
        rent: 1,
        apartmentNumber: 1,
        tower: 1,
        floor: 1,
        customerName: {
          $cond: {
            if: condProj,
            then: { $toUpper: "$customerName" },
            else: "$$REMOVE",
          },
        },
        customerContact: {
          $cond: {
            if: condProj,
            then: { $toUpper: "$customerContact" },
            else: "$$REMOVE",
          },
        },
        salesUserName: {
          $cond: {
            if: condProj,
            then: { $toUpper: "$salesUserName" },
            else: "$$REMOVE",
          },
        },
        salesUserContact: {
          $cond: {
            if: condProj,
            then: { $toUpper: "$salesUserContact" },
            else: "$$REMOVE",
          },
        },
        createdBy: 1,
        isTagged: 1,
        createdOn: 1,
        lastUpdatedOn: 1,
        salesUserID: 1,
        createdByID: 1,
        mylist: 1,
        projectName: 1,
        location: 1,
        size: 1,
      },
    },
  ];
  const leads = await mongo.collection("leads").aggregate(pipeline).toArray();
  // if (needAuthority) {
  //   console.log({ apartmentNumber });
  //   const authority = await mongo
  //     .collection("apartmentsAtuhority")
  //     .aggregate([
  //       {
  //         $match: {
  //           apartmentNumber: { $eq: apartmentNumber },
  //         },
  //       },
  //     ])
  //     .toArray();
  //   console.log({ authority });
  // }
  res.status(200).json({ result: [{ authority }, ...leads] });
});

app.use(
  "/properties/microservice",
  microserviceGenerator({
    collectionName: "properties",
    actions: ["read", "insert", "update", "remove", "filter", "upload", "ids"],
    afterValidationCommand: "GEN_PID",
    validationSchema: propertiesSchema,
    actionCalls: {
      update: {
        fore: propertiesUpdate,
        back: async ({ result, req }) => {
          const allowed = {
            admin: ["admin", "propertyDealer", "salesUser"],
            propertyDealer: ["propertyDealer", "salesUser"],
            salesUser: ["salesUser"],
          };
          const leadsColection = mongo.collection("leads");
          const lead = await leadsColection
            .find({
              pid: result.updatedId,
            })
            .toArray();
          const propertiesCollection = mongo.collection("properties");
          const property = await propertiesCollection
            .aggregate([
              {
                $match: { _id: ObjectId(result.updatedId) },
              },
              {
                $lookup: {
                  from: "leads",
                  let: { propertyID: { $toString: "$_id" } },
                  pipeline: [
                    // {
                    //   $match: {
                    //     $expr: { $in: ["$createdBy", allowed[user.role]] },
                    //   },
                    // },
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
          return property;
        },
      },
      insert: {
        fore: async ({ req, res }) => {
          req.body.id = idGenerator(req.body).id;
          req.body.createdBy = req.user.role;
        },
        back: ({ result }) =>
          filterPropertiesCBID(result.insertedId.toString()),
      },
      filter: {
        fore: async ({ req, res }) => {
          const condProj = {
            $or: [
              {
                $in: [
                  "$salesUserID",
                  [req.user._id.toString(), req.user.parentID],
                ],
              },
              {
                $eq: ["admin", req.user.role],
              },
              {
                $eq: ["$createdByID", req.user._id.toString()],
              },
            ],
          };
          console.log(req.body.pipeline.properties);
          const isPlotNumberAvailable =
            req.body.pipeline.properties.plotNumber &&
            req.body.pipeline.properties.plotNumber !== "" &&
            req.body.pipeline.properties.plotNumber !== null;
          const mylist = req.body.pipeline.properties.mylist;
          console.log({ mylist });
          const c = await mongo
            .collection("leads")
            .aggregate([
              mylist
                ? {
                  $match: {
                    mylist: true,
                  },
                }
                : { $match: {} },
              {
                $match: {
                  $expr: {
                    $or: [
                      {
                        $in: [
                          "$salesUserID",
                          [req.user._id.toString(), req.user.parentID],
                        ],
                      },
                      {
                        $eq: ["admin", req.user.role],
                      },
                      {
                        $in: [
                          "$createdByID",
                          [req.user._id.toString(), req.user.parentID],
                        ],
                      },
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  pid: 1,
                },
              },
            ])
            .toArray();
          const p = c.map(({ pid }) => ObjectId(pid));

          if (mylist) delete req.body.pipeline.properties.mylist;

          req.body.pipeline = [
            {
              $match: {
                ...req.body.pipeline.properties,
              },
            },
            !req.body.pipeline.all && !isPlotNumberAvailable
              ? {
                $match: {
                  $expr: {
                    $in: ["$_id", p],
                  },
                },
              }
              : { $match: {} },
            {
              $lookup: {
                from: "authority",
                let: {
                  propertyID: "$_id",
                },
                pipeline: [
                  {
                    $match: {
                      ...req.body.pipeline.authority,
                    },
                  },
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
                  {
                    $match: {
                      ...req.body.pipeline.maps,
                    },
                  },
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
                        $eq: ["$pid", "$$propertyID"],
                      },
                    },
                  },
                  {
                    $match: {
                      ...req.body.pipeline.leads,
                    },
                  },
                  req.user.role !== "admin"
                    ? {
                      $match: {
                        $expr: {
                          $or: [
                            {
                              $in: [
                                "$salesUserID",
                                [req.user._id.toString(), req.user.parentID],
                              ],
                            },
                            {
                              $eq: ["admin", req.user.role],
                            },
                            {
                              $in: [
                                "$createdByID",
                                [req.user._id.toString(), req.user.parentID],
                              ],
                            },
                          ],
                        },
                      },
                    }
                    : { $match: {} },
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
                      ],
                      as: "isTagged",
                    },
                  },
                  {
                    $lookup: {
                      from: "users",
                      let: {
                        salesUserID: { $toObjectId: "$salesUserID" },
                      },
                      pipeline: [
                        {
                          $match: {
                            $expr: { $eq: ["$_id", "$$salesUserID"] },
                          },
                        },
                        {
                          $project: {
                            _id: 0,
                            name: 1,
                          },
                        },
                      ],
                      as: "createdBy",
                    },
                  },
                  {
                    $project: {
                      cheque: 1,
                      builtup: 1,
                      status: 1,
                      interested: 1,
                      file: 1,
                      comments: {
                        $cond: {
                          if: condProj,
                          then: { $toUpper: "$comments" },
                          else: "$$REMOVE",
                        },
                      },
                      queryFrom: 1,
                      date: 1,
                      lid: 1,
                      pid: 1,
                      demand: 1,
                      offer: 1,
                      output: 1,
                      customerName: {
                        $cond: {
                          if: condProj,
                          then: { $toUpper: "$customerName" },
                          else: "$$REMOVE",
                        },
                      },
                      customerContact: {
                        $cond: {
                          if: condProj,
                          then: { $toUpper: "$customerContact" },
                          else: "$$REMOVE",
                        },
                      },
                      salesUserName: {
                        $cond: {
                          if: condProj,
                          then: { $toUpper: "$salesUserName" },
                          else: "$$REMOVE",
                        },
                      },
                      salesUserContact: {
                        $cond: {
                          if: condProj,
                          then: { $toUpper: "$salesUserContact" },
                          else: "$$REMOVE",
                        },
                      },
                      createdBy: 1,
                      isTagged: 1,
                      createdOn: 1,
                      lastUpdatedOn: 1,
                      salesUserID: 1,
                      createdByID: 1,
                      mylist: 1,
                    },
                  },
                ],
                as: "output",
              },
            },
            {
              $match: {
                $expr: { $gt: [{ $size: "$maps" }, 0] },
              },
            },
            !isPlotNumberAvailable
              ? {
                $match: {
                  $expr: { $gt: [{ $size: "$output" }, 0] },
                },
              }
              : { $match: {} },
          ];
        },
      },
    },
  })
);

// app.use(
//   "/authority/microservice",
//   microserviceGenerator({
//     collectionName: "authority",
//     actions: ["read", "insert", "update", "remove", "filter", "upload", "ids"],
//     validationSchema: propertiesSchema,
//     actionCalls: {
//       update: {
//         fore: propertiesUpdate,
//         back: async ({ result, req }) => {
//           const allowed = {
//             admin: ["admin", "propertyDealer", "salesUser"],
//             propertyDealer: ["propertyDealer", "salesUser"],
//             salesUser: ["salesUser"],
//           };
//           const leadsColection = mongo.collection("leads");
//           const lead = await leadsColection
//             .find({
//               pid: result.updatedId,
//             })
//             .toArray();
//           const propertiesCollection = mongo.collection("properties");
//           const property = await propertiesCollection
//             .aggregate([
//               {
//                 $match: { _id: ObjectId(result.updatedId) },
//               },
//               {
//                 $lookup: {
//                   from: "authority",
//                   let: {
//                     propertyID: "$_id",
//                   },
//                   pipeline: [
//                     {
//                       $match: {
//                         $expr: {
//                           $eq: ["$propertyID", "$$propertyID"],
//                         },
//                       },
//                     },
//                   ],
//                   as: "authority",
//                 },
//               },
//               {
//                 $lookup: {
//                   from: "maps",
//                   let: {
//                     propertyID: "$_id",
//                   },
//                   pipeline: [
//                     // {
//                     //   $match: {
//                     //     ...req.body.pipeline.maps,
//                     //   },
//                     // },
//                     {
//                       $match: {
//                         $expr: {
//                           $eq: ["$propertyID", "$$propertyID"],
//                         },
//                       },
//                     },
//                   ],
//                   as: "maps",
//                 },
//               },
//               {
//                 $lookup: {
//                   from: "leads",
//                   let: { propertyID: { $toString: "$_id" } },
//                   pipeline: [
//                     {
//                       $match: {
//                         $expr: {
//                           $in: [
//                             "$createdByID",
//                             [req.user.parentID, req.user.id],
//                           ],
//                         },
//                       },
//                     },
//                     {
//                       $lookup: {
//                         from: "tags",
//                         let: { leadID: { $toString: "$_id" } },
//                         pipeline: [
//                           {
//                             $match: {
//                               $expr: { $eq: ["$typeToId", "$$leadID"] },
//                             },
//                           },
//                           {
//                             $match: {
//                               $expr: { $eq: ["$typeFormId", req.user.id] },
//                             },
//                           },
//                           {
//                             $project: { name: 1 },
//                           },
//                         ],
//                         as: "isTagged",
//                       },
//                     },
//                     req.user.role === "salesUser"
//                       ? {
//                           $match: {
//                             $expr: {
//                               $ne: ["$createdByID", req.user.id.toString()],
//                             },
//                           },
//                         }
//                       : { $match: {} },
//                     { $match: { $expr: { $eq: ["$pid", "$$propertyID"] } } },
//                     req.user.role === "salesUser"
//                       ? {
//                           $project: {
//                             queryFrom: 1,
//                             createdByID: 1,
//                             pid: 1,
//                             date: 1,
//                           },
//                         }
//                       : {
//                           $project: {
//                             lid: 0,
//                           },
//                         },
//                     {
//                       $project: {
//                         cheque: { $toUpper: "$cheque" },
//                         builtup: { $toUpper: "$builtup" },
//                         status: { $toUpper: "$status" },
//                         interested: { $toUpper: "$interested" },
//                         file: { $toUpper: "$file" },
//                         comments: 1,
//                         queryFrom: 1,
//                         date: 1,
//                         lid: 1,
//                         pid: 1,
//                         demand: 1,
//                         offer: 1,
//                         salesPerson: 1,
//                         customer: 1,
//                         salesUser: 1,
//                         output: 1,
//                         userName: 1,
//                         customerName: 1,
//                         customerContact: 1,
//                         createdBy: 1,
//                         salesUserName: 1,
//                         salesUserContact: 1,
//                         isTagged: 1,
//                         createdOn: 1,
//                       },
//                     },
//                   ],
//                   as: "output",
//                 },
//               },

//               //creted by salesUser
//               // user.role === "salesUser"
//               //   ? {
//               //       $lookup: {
//               //         from: "leads",
//               //         let: { propertyID: { $toString: "$_id" } },
//               //         pipeline: [
//               //           {
//               //             $match: {
//               //               $expr: {
//               //                 $in: ["$createdBy", allowed[user.role]],
//               //               },
//               //             },
//               //           },
//               //           {
//               //             $match: {
//               //               $expr: {
//               //                 $eq: ["$createdByID", user._id.toString()],
//               //               },
//               //             },
//               //           },
//               //           {
//               //             $match: { $expr: { $eq: ["$pid", "$$propertyID"] } },
//               //           },
//               //           {
//               //             $lookup: {
//               //               from: "users",
//               //               let: {
//               //                 cid: { $toObjectId: "$cid" },
//               //               },
//               //               pipeline: [
//               //                 {
//               //                   $match: {
//               //                     $expr: { $eq: ["$_id", "$$cid"] },
//               //                   },
//               //                 },
//               //                 {
//               //                   $project: { name: 1, contact: 1 },
//               //                 },
//               //               ],
//               //               as: "output.customer",
//               //             },
//               //           },
//               //           {
//               //             $lookup: {
//               //               from: "users",
//               //               let: {
//               //                 suid: { $toObjectId: "$suid" },
//               //               },
//               //               pipeline: [
//               //                 {
//               //                   $match: {
//               //                     $expr: { $eq: ["$_id", "$$suid"] },
//               //                   },
//               //                 },
//               //                 {
//               //                   $project: { name: 1, contact: 1 },
//               //                 },
//               //               ],
//               //               as: "output.salesUser",
//               //             },
//               //           },
//               //           {
//               //             $lookup: {
//               //               from: "users",
//               //               let: {
//               //                 createdByID: { $toObjectId: "$createdByID" },
//               //               },
//               //               pipeline: [
//               //                 {
//               //                   $match: {
//               //                     $expr: { $eq: ["$_id", "$$createdByID"] },
//               //                   },
//               //                 },
//               //                 {
//               //                   $project: { name: 1 },
//               //                 },
//               //               ],
//               //               as: "userName.createdBy",
//               //             },
//               //           },
//               //         ],
//               //         as: "cdoutput",
//               //       },
//               //     }
//               //   : { $match: {} },
//             ])
//             .toArray();
//           return property;
//         },
//       },
//       insert: {
//         fore: async ({ req, res }) => {
//           req.body.createdByID = req.user.id;
//         },
//         back: ({ result }) =>
//           filterPropertiesCBID(result.insertedId.toString()),
//       },
//       filter: {
//         fore: ({ req, res }) => {
//           const allowed = {
//             admin: ["admin", "propertyDealer", "salesUser"],
//             propertyDealer: ["propertyDealer", "salesUser"],
//             salesUser: ["salesUser"],
//           };
//           req.body.pipeline = [
//             ...req.body.pipeline,
//             // {
//             //   $match: { createdBy: { $in: [null, "admin"] } },
//             // },
//             {
//               $lookup: {
//                 from: "leads",
//                 let: { propertyID: { $toString: "$_id" } },
//                 pipeline: [
//                   {
//                     $match: {
//                       $expr: {
//                         $in: [
//                           "$createdByID",
//                           [req.user.parentID, req.user.id],
//                         ],
//                       },
//                     },
//                   },
//                   {
//                     $lookup: {
//                       from: "tags",
//                       let: { leadID: { $toString: "$_id" } },
//                       pipeline: [
//                         {
//                           $match: {
//                             $expr: { $eq: ["$typeToId", "$$leadID"] },
//                           },
//                         },
//                         {
//                           $match: {
//                             $expr: { $eq: ["$typeFormId", req.user.id] },
//                           },
//                         },
//                         {
//                           $project: { name: 1 },
//                         },
//                       ],
//                       as: "isTagged",
//                     },
//                   },
//                   req.user.role === "salesUser"
//                     ? {
//                         $match: {
//                           $expr: {
//                             $ne: ["$createdByID", req.user.id.toString()],
//                           },
//                         },
//                       }
//                     : { $match: {} },
//                   { $match: { $expr: { $eq: ["$pid", "$$propertyID"] } } },
//                   req.user.role === "salesUser"
//                     ? {
//                         $project: {
//                           queryFrom: 1,
//                           createdByID: 1,
//                           pid: 1,
//                           date: 1,
//                         },
//                       }
//                     : {
//                         $project: {
//                           lid: 0,
//                         },
//                       },
//                   {
//                     $project: {
//                       cheque: { $toUpper: "$cheque" },
//                       builtup: { $toUpper: "$builtup" },
//                       status: { $toUpper: "$status" },
//                       interested: { $toUpper: "$interested" },
//                       file: { $toUpper: "$file" },
//                       comments: 1,
//                       queryFrom: 1,
//                       date: 1,
//                       lid: 1,
//                       pid: 1,
//                       demand: 1,
//                       offer: 1,
//                       salesPerson: 1,
//                       customer: 1,
//                       salesUser: 1,
//                       output: 1,
//                       userName: 1,
//                       customerName: 1,
//                       customerContact: 1,
//                       createdBy: 1,
//                       salesUserName: 1,
//                       salesUserContact: 1,
//                       isTagged: 1,
//                       createdOn: 1,
//                     },
//                   },
//                 ],
//                 as: "output",
//               },
//             },
//             //creted by salesUser
//             // req.user.role === "salesUser"
//             //   ? {
//             //       $lookup: {
//             //         from: "leads",
//             //         let: { propertyID: { $toString: "$_id" } },
//             //         pipeline: [
//             //           {
//             //             $match: {
//             //               $expr: {
//             //                 $in: ["$createdBy", allowed[req.user.role]],
//             //               },
//             //             },
//             //           },
//             //           {
//             //             $match: {
//             //               $expr: {
//             //                 $eq: ["$createdByID", req.user._id.toString()],
//             //               },
//             //             },
//             //           },
//             //           { $match: { $expr: { $eq: ["$pid", "$$propertyID"] } } },
//             //           {
//             //             $lookup: {
//             //               from: "users",
//             //               let: {
//             //                 cid: { $toObjectId: "$cid" },
//             //               },
//             //               pipeline: [
//             //                 {
//             //                   $match: {
//             //                     $expr: { $eq: ["$_id", "$$cid"] },
//             //                   },
//             //                 },
//             //                 {
//             //                   $project: { name: 1, contact: 1 },
//             //                 },
//             //               ],
//             //               as: "output.customer",
//             //             },
//             //           },
//             //           {
//             //             $lookup: {
//             //               from: "users",
//             //               let: {
//             //                 suid: { $toObjectId: "$suid" },
//             //               },
//             //               pipeline: [
//             //                 {
//             //                   $match: {
//             //                     $expr: { $eq: ["$_id", "$$suid"] },
//             //                   },
//             //                 },
//             //                 {
//             //                   $project: { name: 1, contact: 1 },
//             //                 },
//             //               ],
//             //               as: "output.salesUser",
//             //             },
//             //           },
//             //           {
//             //             $lookup: {
//             //               from: "users",
//             //               let: {
//             //                 createdByID: { $toObjectId: "$createdByID" },
//             //               },
//             //               pipeline: [
//             //                 {
//             //                   $match: {
//             //                     $expr: { $eq: ["$_id", "$$createdByID"] },
//             //                   },
//             //                 },
//             //                 {
//             //                   $project: { name: 1 },
//             //                 },
//             //               ],
//             //               as: "userName.createdBy",
//             //             },
//             //           },
//             //         ],
//             //         as: "cdoutput",
//             //       },
//             //     }
//             //   : { $match: {} },
//             // {
//             //   $match: {
//             //     $expr: { $gt: [{ $size: "$output" }, 0] },
//             //   },
//             // },
//             // req.user.role === "salesUser"
//             //   ? {
//             //       $match: {
//             //         $expr: { $gt: [{ $size: "$cdoutput" }, 0] },
//             //       },
//             //     }
//             //   : { $match: {} },
//           ];
//         },
//       },
//     },
//   })
// );

app.use(
  "/properties/microservice/auto",
  microserviceGenerator({
    collectionName: "properties",
    actions: ["read", "insert", "update", "remove", "filter", "upload", "ids"],
    afterValidationCommand: "GEN_PID",
    validationSchema: propertiesSchema,
    actionCalls: {
      filter: {
        fore: ({ req, res }) => {
          const allowed = {
            admin: ["admin", "propertyDealer", "salesUser"],
            propertyDealer: ["propertyDealer", "salesUser"],
            salesUser: ["salesUser"],
          };
          req.body.pipeline = [...req.body.pipeline];
        },
        back: async ({ result, role }) => {
          const newResult = result.documents.map((document) => {
            if (document[role]?.length > 0) {
              console.log(role);
              return {
                output: document.output,
                ...document[role][0],
                _id: document._id,
              };
            } else {
              return document;
            }
          });
          console.log(newResult);
          return newResult;
        },
      },
    },
  })
);

app.use(
  "/users/microservice",
  microserviceGenerator({
    collectionName: "users",
    actions: ["read", "insert", "update", "remove", "filter", "upload", "ids"],
    actionCalls: {
      insert: {
        fore: ({ req, res }) => (req.body.active = false),
        back: ({ result }) => {
          sendPasswordResetLink(result.insertedId.toString());
        },
      },
    },
  })
);

app.use(
  "/leads/microservice",
  microserviceGenerator({
    collectionName: "leads",
    actions: ["read", "insert", "update", "remove", "filter", "upload"],
    actionCalls: {
      insert: {
        fore: async ({ req, res }) => {
          const { action, sectorNumber, plotNumber, ...props } = req.body;
          req.body = props;
          if (props.category === "APT") {
          }
          if (props.category === "PLOT") {
            if (!props.pid) {
              if (!category || !sectorNumber || !plotNumber) {
                throw new Error(
                  "Category, Sector Number and Plot Number are required"
                );
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
              req.body["pid"] = propertiesResult.insertedId.toString();
            }
          }

          console.log(req.user);
          req.body["createdByID"] =
            req.user.parentID ?? req.user._id.toString();
          req.body["createdBy"] = req.user.role;
          req.body["createdOn"] = new Date();
          req.body["lastUpdatedOn"] = new Date();
          req.body["salesUserID"] = req.user._id.toString();
        },
      },
      update: {
        fore: async ({ req, res }) => {
          const { action, ...props } = req.body;
          req.body = props;
          console.log("props", props)
          const counters = mongo.collection("counters");
          // if (!props.pid) {
          //   const propertiesCollection = mongo.collection("properties");
          //   const propertiesResult = await propertiesCollection.insertOne(
          //     idGenerator({
          //       category: props.category,
          //       sectorNumber: props.sectorNumber,
          //       plotNumber: props.plotNumber,
          //       state: "haryana",
          //       city: "gurugram",
          //     })
          //   );
          //   req.body["pid"] = propertiesResult.insertedId.toString();
          // }
        },
        back: async ({ result, req }) => {
          // console.log({ user, result });
          const leadsColection = mongo.collection("leads");
          const lead = await leadsColection.findOne({
            _id: ObjectId(result.updatedId),
          });
          const condProj = {
            $or: [
              {
                $in: [
                  "$salesUserID",
                  [req.user._id.toString(), req.user.parentID],
                ],
              },
              {
                $eq: ["admin", req.user.role],
              },
              {
                $eq: ["$createdByID", req.user._id.toString()],
              },
            ],
          };

          if (lead) {
            const allowed = {
              admin: ["admin", "propertyDealer", "salesUser"],
              propertyDealer: ["propertyDealer", "salesUser"],
              salesUser: ["salesUser"],
            };
            const propertiesCollection = mongo.collection("properties");
            const property = await propertiesCollection
              .aggregate([
                {
                  $match: { _id: ObjectId(lead.pid) },
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
                            $eq: ["$pid", "$$propertyID"],
                          },
                        },
                      },
                      {
                        $match: {
                          ...req.body.pipeline?.leads,
                        },
                      },
                      req.user.role !== "admin"
                        ? {
                          $match: {
                            $expr: {
                              $or: [
                                {
                                  $in: [
                                    "$salesUserID",
                                    [
                                      req.user._id.toString(),
                                      req.user.parentID,
                                    ],
                                  ],
                                },
                                {
                                  $eq: ["admin", req.user.role],
                                },
                                {
                                  $in: [
                                    "$createdByID",
                                    [
                                      req.user._id.toString(),
                                      req.user.parentID,
                                    ],
                                  ],
                                },
                              ],
                            },
                          },
                        }
                        : { $match: {} },
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
                          ],
                          as: "isTagged",
                        },
                      },
                      {
                        $lookup: {
                          from: "users",
                          let: {
                            salesUserID: { $toObjectId: "$salesUserID" },
                          },
                          pipeline: [
                            {
                              $match: {
                                $expr: { $eq: ["$_id", "$$salesUserID"] },
                              },
                            },
                            {
                              $project: {
                                _id: 0,
                                name: 1,
                              },
                            },
                          ],
                          as: "createdBy",
                        },
                      },
                      {
                        $project: {
                          cheque: 1,
                          builtup: 1,
                          status: 1,
                          interested: 1,
                          file: 1,
                          comments: {
                            $cond: {
                              if: condProj,
                              then: { $toUpper: "$comments" },
                              else: "$$REMOVE",
                            },
                          },
                          queryFrom: 1,
                          date: 1,
                          lid: 1,
                          pid: 1,
                          demand: 1,
                          offer: 1,
                          output: 1,
                          customerName: {
                            $cond: {
                              if: condProj,
                              then: { $toUpper: "$customerName" },
                              else: "$$REMOVE",
                            },
                          },
                          customerContact: {
                            $cond: {
                              if: condProj,
                              then: { $toUpper: "$customerContact" },
                              else: "$$REMOVE",
                            },
                          },
                          salesUserName: {
                            $cond: {
                              if: condProj,
                              then: { $toUpper: "$salesUserName" },
                              else: "$$REMOVE",
                            },
                          },
                          salesUserContact: {
                            $cond: {
                              if: condProj,
                              then: { $toUpper: "$salesUserContact" },
                              else: "$$REMOVE",
                            },
                          },
                          createdBy: 1,
                          isTagged: 1,
                          createdOn: 1,
                          salesUserID: 1,
                          createdByID: 1,
                          mylist: 1,
                          lastUpdatedOn: 1
                        },
                      },
                    ],
                    as: "output",
                  },
                },
              ])
              .toArray();

            return {
              collectionName: "properties",
              ...property,
            };
          }
        },
      },
      remove: {
        back: async ({ result }) => {
          const propertiesCollection = mongo.collection("properties");
          const property = await propertiesCollection.findOne({
            _id: ObjectId(result.value.pid),
          });
          return {
            collectionName: "properties",
            action: "update",
            ...property,
            output: [],
          };
        },
      },
    },
  })
);

app.use(
  "/communications/microservice",
  microserviceGenerator({
    collectionName: "leads",
    actions: ["read", "insert", "update", "remove", "filter", "upload"],
  })
);

app.use(
  "/blogs/microservice",
  microserviceGenerator({
    collectionName: "blogs",
    actions: ["read", "insert", "update", "remove", "filter", "upload"],
    actionCalls: {
      insert: {
        fore: ({ req, res }) => {
          req.body = {
            lastUpdate: Date.now(),
            ...req.body,
          };
        },
        back: async ({ result }) => {
          const collection = mongo.collection("tags");
          await collection.insertOne({
            typeForm: "users",
            typeTo: "blogs",
            typeFormId: result._id,
            typeToId: result.insertedId.toString(),
          });
          return await mongo
            .collection("blogs")
            .findOne({ _id: result.insertedId });
        },
      },
    },
  })
);

app.use(
  "/meetings/microservice",
  microserviceGenerator({
    collectionName: "meetings",
    actions: ["read", "insert", "update", "remove", "filter", "upload"],
  })
);


app.use("/searches/getnextplotnumber2", (async (req, res) => {
  const collection = mongo.collection("properties");
  let dataPrev = {};
  let dataNext = {};
  try {
    const response = await collection.findOne({
      category: req.body.category, sectorNumber: req.body.sectorNumber, plotNumber: req.body.plotNumber
    });
    console.log(response);
    const seqNoprev = parseInt(response.sequenceNumber) - 1;
    dataPrev = await collection.findOne({
      sequenceNumber: String(seqNoprev)
    });
    console.log(dataPrev);

    const seqNo = parseInt(response.sequenceNumber) + 1;

    dataNext = await collection.findOne({
      sequenceNumber: String(seqNo)
    });
    console.log(dataNext);

    res.send({ dataPrev, dataNext });

  } catch (ex) {
    res.status(400).send(ex);
  }
}));

app.use("/searches/microservicev2", (async (req, res) => {
  const collection = mongo.collection("searches");
  const { _id, ...update } = req.body
  try {
    const updateResponse = await collection.updateOne(
      { uid: req.body.uid },
      {
        $set: {
          ...update
        },
      },
      {
        upsert: true
      });
    res.send({ updateResponse });
  } catch (e) {
    console.log(e)
    res.send(e);
  }
}));


app.use(
  "/searches/microservice",
  microserviceGenerator({
    collectionName: "searches",
    actions: ["read", "insert", "update", "remove", "filter", "upload"],
    actionCalls: {
      update: {
        fore: async ({ req, res }) => {
          req.body = {
            ...req.body,
            uid: req.user.id,
          };
        },
        back: async ({ result }) => {
          const collection = mongo.collection("searches");
          return await collection.findOne({
            _id: result.upsertedId ?? result.insertedId,
          });
        },
      },
      filter: {
        fore: async ({ req, res }) => {
          req.body = {
            ...req.body,
            pipeline: [
              ...req.body.pipeline,
              { $match: { uid: { $eq: req.user.id } } },
            ],
          };
        },
      },
    },
  })
);

app.use(
  "/tags/microservice",
  microserviceGenerator({
    collectionName: "tags",
    actions: ["read", "insert", "update", "remove", "filter", "upload"],
    actionCalls: {
      update: {
        fore: async ({ req, res }) => {
          req.body["createdBy"] = req.user._id.toString();
        },
      },
    },
  })
);

app.use(
  "/communications/microservice",
  microserviceGenerator({
    collectionName: "masterCommunications",
    actions: ["read", "insert", "update", "remove", "filter", "upload"],
  })
);

app.use(
  "/management/microservice",
  microserviceGenerator({
    collectionName: "masterManagement",
    actions: ["read", "insert", "update", "remove", "filter", "upload"],
    actionCalls: {
      filter: {
        fore: async ({ req, res }) => {
          const module = req.body.pipeline[0].$match.parent;
          req.attachments = {};
          req.attachments.fieldPermissions = await fieldPermissions(
            req.user.role,
            module
          );
        },
      },
    },
  })
);

app.post("/leads/tag", jwt, upload.array("images"), async (req, res) => {
  const collection = mongo.collection("tags");
  const { leadID, value, ...data } = req.body;
  const images = await Promise.all(
    await req.files.map(async (file) => {
      const location = await uploadtos3(file);
      return location;
    })
  );
  const checkvalue = (value) => {
    if (value && value !== "undefined" && value !== "") return value;
    return null;
  };
  if (value === "true") {
    const result = await collection.insertOne(
      {
        typeForm: "users",
        typeTo: "leads",
        typeFormId: req.user.id,
        typeToId: leadID,
        userID: ObjectId(req.user.id),
        phoneNumber: checkvalue(data.phoneNumber),
        propertyID: checkvalue(data.propertyID),
        title: checkvalue(data.title),
        city: checkvalue(data.city),
        sectorNumber: checkvalue(data.locality),
        description: checkvalue(data.description),
        email: checkvalue(data.email),
        price: checkvalue(data.price),
        rating: checkvalue(data.rating),
        images,
      },
      {}
    );
    res.send(result);
  } else {
    const result = await collection.deleteOne({
      typeForm: "users",
      typeTo: "leads",
      typeFormId: req.user.id,
      typeToId: leadID,
    });
    res.send(result);
  }
});

app.use(
  "/right/microservice",
  microserviceGenerator({
    collectionName: "masterRights",
    actions: ["read", "insert", "update", "remove", "filter", "upload"],
  })
);

app.post("/api/leads", async (req, res) => {
  const { userID, leadID } = req.body;
  const collection = mongo.collection("tags");
  try {
    if (leadID) {
      const lead = await collection.findOne({
        _id: ObjectId(leadID)
      }, {
        typeForm: 0,
        typeTo: 0,
        typeFormId: 0,
        typeToId: 0,
      })
      res.send(lead);
      return
    }
    const taggedProperties = await collection
      .aggregate([
        {
          $match: {
            userID: { $eq: ObjectId(userID) },
          },
        },
        {
          $project: {
            typeForm: 0,
            typeTo: 0,
            typeFormId: 0,
            typeToId: 0,
          },
        },
      ])
      .toArray();
    res.send(taggedProperties);
  } catch (error) {
    console.log(error)
  }
});

module.exports = app;