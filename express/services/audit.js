const auditFields = require("../constants/audit");
const model = require("../mongo/mongo.js");

const collection = model.collection("audits");

async function audit(oldDocument, newDocument, service, email) {
  //to configure more audit fields fetch the "audit[service]" directly from database
  try {
    const fields = auditFields[service];
    // const user = await model
    //   .collection("users")
    //   .findOne({ email: { $eq: email } });
    const changes = [];
    fields.forEach(async (field) => {
      if (oldDocument[field] !== newDocument[field]) {
        changes.push({
          field,
          changeFrom: oldDocument[field],
          changeTo: newDocument[field],
        });
      }
    });
    if (changes.length > 0) {
      const result = await collection.insertOne({
        id: oldDocument["id"],
        module: service,
        user: `${user.firstName} ${user.lastName}`,
        changes,
        on: Date.now(),
      });
    }
  } catch (error) {
    throw error;
  }
}

module.exports = audit;
