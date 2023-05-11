const csv = require("csv-parser");
const fs = require("fs");
const { ObjectId } = require("mongodb");
const mongo = require("./mongo");

const properties = mongo.collection("properties");

const results = [];
const IDS = [];

const count = 0;

fs.createReadStream("./apartment.csv")
  .pipe(csv())
  .on("data", async (apartment) => {
    const sizes = [];
    console.log(apartment);
    for (let i = 0; i < 10; i++) {
      const size = apartment[`SIZE${i + 1}`];
      if (size !== "" && size !== null) sizes.push(size);
    }
    results.push({
      updateOne: {
        filter: {
          projectName: apartment["Project Name"],
        },
        update: {
          $set: {
            sizes: {
              [apartment["Location"]]: sizes,
            },
          },
        },
      },
    });
  })
  .on("end", async () => {
    const r = await properties.bulkWrite(results);

    console.log(r);
    // await collection.deleteMany({ propertyID: { $in: IDS } });
    // await collection.insertMany(results);
    // results.forEach(async ({ _id }) => {
    //   return;
    //   const propertyID = ObjectId(data._id);
    //   await collection.updateOne(
    //     {
    //       propertyID: propertyID,
    //     },
    //     {
    //       $set: {
    //         ownerName: data.ownerName,
    //         phoneNumber: data.mobile,
    //       },
    //     }
    //   );
    //   count += 1;
    //   console.log(count);
    // });
    console.log("FINISH");
  });

console.log(results);
