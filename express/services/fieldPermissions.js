const model = require("../mongo/mongo");

const collection = model.collection("fieldPermissions");

//fetches field level validation
async function fieldPermissions(role, module) {
  const permissions = await collection
    .aggregate([
      {
        $match: {
          module,
        },
      },
      {
        $set: { action: `$${role}` },
      },
      {
        $unset: [
          "superAdmin",
          "admin",
          "propertyDealer",
          "salesPerson",
          "vendor",
          "_id",
          "audit",
        ],
      },
    ])
    .toArray();
  return permissions;
}

module.exports = fieldPermissions;
