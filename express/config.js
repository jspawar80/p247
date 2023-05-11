var fs = require("fs");
const reader = require("xlsx");
const { google } = require("googleapis");
const { ObjectId } = require("mongodb");

const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: "https://www.googleapis.com/auth/spreadsheets",
});
/******************************************************************************/

const spreadsheetId = "1aVZFfZAhb35dvH5s-dmRlUeZp2jrTFqKDGUIslSy_l4";

// Get metadata about spreadsheet
// const metaData = await googleSheets.spreadsheets.get({
//   auth,
//   spreadsheetId,
// });

async function get_data_masters() {
  const client = await auth.getClient();
  // Instance of Google Sheets API
  const googleSheets = google.sheets({ version: "v4", auth: client });
  const getRows = await googleSheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: "Data Masters!A:D",
  });
  return getRows.data.values.map((row) => {
    return {
      code: row[0],
      key: row[1],
      parent: row[2],
      value: row[3],
    };
  });
}

async function get_user_groups() {
  const client = await auth.getClient();
  // Instance of Google Sheets API
  const googleSheets = google.sheets({ version: "v4", auth: client });
  const getRows = await googleSheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: "User Groups!A:D",
  });
  return getRows.data.values.map((row, index) => {
    if (index === 0) return {};
    return {
      _id: ObjectId(row[0]),
      createdBy: ObjectId(row[1]),
      members: JSON.parse(row[2]).map((member) => ObjectId(member)),
      parent: row[3] !== "null" ? ObjectId(row[3]) : null,
    };
  });
}

async function get_crud_permissions() {
  const client = await auth.getClient();
  // Instance of Google Sheets API
  const googleSheets = google.sheets({ version: "v4", auth: client });
  const getRows = await googleSheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: "CRUD Permissions!A:F",
  });
  return getRows.data.values.map((row, index) => {
    if (index === 0) return {};
    return {
      _id: ObjectId(row[0]),
      createdBy: row[1] !== "null" ? ObjectId(row[1]) : null,
      groupID: ObjectId(row[2]),
      permission: JSON.parse(row[3]),
      role: row[4],
      screen: row[5],
    };
  });
}

async function get_field_permissions() {
  const client = await auth.getClient();
  // Instance of Google Sheets API
  const googleSheets = google.sheets({ version: "v4", auth: client });
  const getRows = await googleSheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: "Field Permissions & Validations!A:F",
  });
  return getRows.data.values.map((row, index) => {
    if (index === 0) return {};
    return {
      actionOn: row[0],
      createdBy: row[1] !== "null" ? ObjectId(row[1]) : null,
      field: row[2],
      groupID: ObjectId(row[3]),
      permission: row[4],
      role: row[5],
    };
  });
}

module.exports = {
  get_data_masters,
  get_user_groups,
  get_crud_permissions,
  get_field_permissions,
};
