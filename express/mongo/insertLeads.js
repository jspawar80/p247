(async function insertLeads() {
  const mongo = require("./mongo");

  const propertiesCollection = mongo.collection("properties");
  const authorityCollection = mongo.collection("authority");
  const mapsCollection = mongo.collection("maps");
  const usersCollection = mongo.collection("users");
  const leadsCollection = mongo.collection("leads");
  const leadsIDS = await leadsCollection.aggregate().toArray();
  const propertiesIDS = await propertiesCollection.aggregate().toArray();
  return;
  // propertiesCollection.deleteMany({}).then(() => {});
  // authorityCollection.deleteMany({}).then(() => {});
  // mapsCollection.deleteMany({}).then(() => {});
  leadsCollection.deleteMany({}).then(() => {});
  return;

  function findProperty(filters) {
    return propertiesIDS.find((property) => {
      let isFound = false;
      for (let prop in filters) {
        if (isFound) {
          break;
        }
        if (filters[prop] === property[prop]) isFound = property;
      }
      return isFound;
    });
  }

  leadsIDS.forEach(async ({ _id, Plotno, Location, cid }) => {
    const property = findProperty({
      plotNumber: Plotno,
      sectorNumber: Location,
      category: "PLOT",
      city: "GURUGRAM",
      state: "HARYANA",
    });

    usersCollection
      .insertOne({
        name: cid,
        role: "customer",
      })
      .then((user) => {
        console.count("USER CREATED");
        if (!property) {
          propertiesCollection
            .insertOne({
              plotNumber: Plotno,
              sectorNumber: Location,
              category: "PLOT",
              city: "GURUGRAM",
              state: "HARYANA",
            })
            .then((property) => {
              if (user && property) {
                console.count("PROPERTY CREATED");
                leadsCollection
                  .updateOne(
                    { _id },
                    {
                      $set: {
                        pid: property._id.toString(),
                        cid: user.insertedId.toString(),
                      },
                      $unset: { Plotno: "", Location: "", category: "" },
                    }
                  )
                  .then(() => {
                    console.count("DONE");
                  });
              }
            });
        }
        if (user && property) {
          console.count("PROPERTY FETCHED");
          leadsCollection
            .updateOne(
              { _id },
              {
                $set: {
                  pid: property._id.toString(),
                  cid: user.insertedId.toString(),
                },
                $unset: { Plotno: "", Location: "", category: "" },
              }
            )
            .then(() => {
              console.count("DONE");
            });
        }
      });
  });
})();

console.log("FINISH");
