const idGenerator = require("./idGenerator.js");

const afterValidationCallbacks = {
  GEN_PID: idGenerator,
};

module.exports = afterValidationCallbacks;
