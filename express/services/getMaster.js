const { Router } = require("express");
const mongo = require("../mongo/mongo");
const jwt = require("../middlewares/jwt");
const getFieldPermissions = require("./fieldPermissions");

const router = Router();

router.post("/", jwt, async (req, res) => {
  const masterManagement = mongo.collection("masterManagement");
  const searches = mongo.collection("searches");
  const module = req.body.module;

  let enums = await masterManagement
    .find({ parent: { $regex: `^${module}` } })
    .toArray();

  let enFinal = [];
  enums.forEach((en) => {
     if (en.key === "categories" && (en.value === 'Plot' || en.value === 'Apartment'))
     enFinal.push(en) ;
  })
  
  const defaultSearch = await searches.findOne({
    module: module,
    uid: req.user._id.toString(),
  });

  const fieldPermissions = await getFieldPermissions("admin", module);

  req.user
    ? res.status(200).json({
        enFinal,
        defaultSearch,
        fieldPermissions,
      })
    : res.status(401);
});

module.exports = router;
