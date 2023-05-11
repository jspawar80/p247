const { parentPort, workerData } = require("worker_threads");
const model = require("../mongo/mongo.js");
const afterValidationCallbacks = require("./afterValidationCallbacks.js");
const Ajv = require("ajv");
const { ObjectId } = require("mongodb");
const ajv = new Ajv();

function upload({
  collectionName,
  documents,
  validationSchema,
  afterValidationCommand,
}) {
  const logs = { validDocuments: [], invalidDocuments: [] };
  console.log(validationSchema);
  try {
    const properties = documents.map(
      ({ state, city, category, plotNumber, sectorNumber }) => ({
        state,
        city,
        category,
        plotNumber,
        sectorNumber,
        _id: ObjectId(),
      })
    );
    const maps = documents.map(
      ({ size, roadWidth, parkFacing, cornerPlot, direction }, index) => ({
        size,
        roadWidth,
        parkFacing,
        cornerPlot,
        direction,
        propertyID: properties[index]._id,
      })
    );
    const authority = documents.map(
      ({ ownerName, owenerFather, address, phoneNumber }, index) => ({
        ownerName,
        owenerFather,
        address,
        phoneNumber,
        propertyID: properties[index]._id,
      })
    );
    const propertiesCollection = model.collection("properties");
    const authorityCollection = model.collection("authority");
    const mapsCollection = model.collection("maps");
    propertiesCollection.insertMany(properties);
    authorityCollection.insertMany(authority);
    mapsCollection.insertMany(maps);
    return;
    documents.forEach((document, index) => {
      let valid = true;
      if (validationSchema) {
        valid = ajv.validate(validationSchema, document);
        // console.count(valid);
      }
      if (!valid) {
        logs.invalidDocuments.push({ ...document, error: ajv.error });
      } else {
        if (afterValidationCallbacks[afterValidationCommand]) {
          const processedDocument =
            afterValidationCallbacks[afterValidationCommand](document);
          logs.validDocuments.push(processedDocument);
        } else {
          logs.validDocuments.push(document);
        }
        //TODO upload to mongo here
      }
    });
    // if (logs.validDocuments.length > 0) {
    //   const collection = model.collection(collectionName);
    //   collection
    //     .insertMany(logs.validDocuments, { ordered: false })
    //     .then((result) => {
    //       console.log(result);
    //     });
    // }
    parentPort.postMessage({ logs });
  } catch (error) {
    console.error(error);
  }
}

upload({
  collectionName: workerData.collectionName,
  documents: workerData.documents,
  validationSchema: workerData.validationSchema,
  afterValidationCommand: workerData.afterValidationCommand,
});
