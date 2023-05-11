const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const model = require("../mongo/mongo");
const mail = require("./mail.js");

const collection = model.collection("users");

async function sendPasswordResetLink(_id, origin) {
  const user = await collection.findOne({ _id: ObjectId(_id) });
  const token = jwt.sign({ _id }, process.env.EMAIL_SECRET, {
    expiresIn: "1h",
  });
  if (user?.email) {
    mail(user.email, `${origin}/confirmpassword?_token=${token}`);
  }
}

module.exports = sendPasswordResetLink;
