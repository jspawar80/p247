const abbreviation = require("../constants/abbreviations.js");

// { state, city, category, sectorNumber, plotNumber }

const format = ["state", "city", "category", "sectorNumber", "plotNumber"];
// AKIAYNI37RHETROZIPUG;
// WPlqi0ZjEm6aMNZpKEnErziLJyUBMgLb+o/462/F
function idGenerator(props) {
  const result = {};
  const id = format.map((field) => {
    if (abbreviation[field]) {
      if (field === "category") return props[field];
      return abbreviation[field][props[field]];
    } else {
      return props[field];
    }
  });

  for (key in props) {
    if (typeof props[key] === "string") {
      result[key] = props[key].toUpperCase();
    } else {
      result[key] = props[key];
    }
  }
  return {
    ...result,
    id: id.join("/"),
  };
}

module.exports = idGenerator;
