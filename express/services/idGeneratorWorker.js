const { parentPort, workerData } = require("worker_threads");
const model = require("../mongo/mongo.js");
const idGenerator = require("./idGenerator.js");
const Ajv = require("ajv");
const ajv = new Ajv();

//should not be called until documents are validated
async function idGeneratorWorker(documents) {
  try {
    documents.forEach((document, index) => {
      documents[index]["id"] = idGenerator(document);
    });
    parentPort.postMessage({ documents });
  } catch (error) {
    throw error;
  }
}

idGeneratorWorker(workerData.documents);
