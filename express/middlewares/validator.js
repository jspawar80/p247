const Ajv = require("ajv").default;
const ajv = new Ajv({ allErrors: true });
require("ajv-errors")(ajv);

const propertiesSchema = {
  type: "object",
  properties: {},
  required: [],
};

module.exports = { propertiesSchema };
