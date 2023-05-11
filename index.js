const express = require("express");
const app = require("./express/index");
const mongo = require("./express/mongo/mongo");
require("dotenv").config();

const PORT = 3000;

console.log(process.env.MONGO_URI);

app.use("/upload", express.static("upload"));
app.listen(process.env.PORT || PORT, () =>
  console.log(`Server running at port ${PORT}`)
);
