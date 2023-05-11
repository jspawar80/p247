const { ObjectId } = require("mongodb");
const mongo = require("../mongo/mongo");

const users = mongo.collection("users");

const customers = [
  "6342afbd104ee76a8d5a9617",
  "6342afbd104ee76a8d5a9617",
  "6342b77b104ee76a8d5a9627",
  "6342b7c4104ee76a8d5a962a",
  "6342b802104ee76a8d5a962d",
  "6342b82a104ee76a8d5a9630",
  "6342b8a9104ee76a8d5a9636",
  "6342c31a104ee76a8d5a967b",
  "634b94357a5042645b9f9ec8",
  "634b9e3f7a5042645b9fa047",
  "634bb0be7a5042645b9fa2ce",
  "636096ada47b928b3b22f6b4",
  "636096ada47b928b3b22f6b5",
  "636096ada47b928b3b22f6b7",
  "636096ada47b928b3b22f6b8",
  "636096ada47b928b3b22f6bf",
  "636096ada47b928b3b22f6c0",
  "636096ada47b928b3b22f6c1",
  "636096ada47b928b3b22f6c2",
  "636096ada47b928b3b22f6c3",
  "636096ada47b928b3b22f6c5",
  "636096ada47b928b3b22f6c4",
  "636096ada47b928b3b22f6c6",
  "636096ada47b928b3b22f6be",
  "636096ada47b928b3b22f6c7",
];

const contacts = [
  "7777777788",
  "7777777779",
  "7777777786",
  "7777777780",
  "7777777789",
  "7777777778",
  "7777777777",
  "7777777787",
  "7777777783",
  "7777777790",
  "7777777781",
  "7777777782",
  "7777777784",
  "7777777785",
  "7777777792",
  "7777777793",
  "7777777794",
  "7777777795",
  "7777777796",
  "7777777798",
  "7777777797",
  "7777777799",
  "7777777791",
  "7777777800",
];

customers.forEach(async function (customerID, index) {
  const response = await users.updateMany(
    { _id: ObjectId(customerID) },
    {
      $set: {
        contact: contacts[index],
      },
    }
  );
  console.log({ response });
});
