const fs = require("fs");
const AWS = require("aws-sdk");
const uuid = require("uuid");

const s3 = new AWS.S3({
  accessKeyId: "AKIAYNI37RHE7TZP5IIQ",
  secretAccessKey: "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",
});

const uploadtos3 = async (file) => {
  const params = {
    Bucket: "p24x7",
    Key: uuid.v4(),
    Body: fs.createReadStream(file.path),
    ContentType: file.mimetype,
  };
  const upload = await s3.upload(params).promise();
  return upload.Location;
};

module.exports = uploadtos3;
