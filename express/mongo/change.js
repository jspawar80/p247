(async function () {
  const mongo = require("./mongo");
  const roleMap = {
    "630373b5708fdaba1fae5440": "propertyDealer",
    d630a8c28638edcc5b192d520: "salesUser",
    "63422d3bda1e6d34c2a3f76e": "salesUser",
    "63083df014653bd2ba778a06": "salesUser",
  };
  
  const leadsCollection = mongo.collection("leads");
  const leads = await leadsCollection.aggregate().toArray();
  leads.forEach(({ _id, createdBy }) => {
    leadsCollection.updateOne(
      { _id },
      {
        $set: {
          createdByID: createdBy,
          createdBy: roleMap[createdBy],
        },
      }
    );
    console.count("DONE");
  });
})();
