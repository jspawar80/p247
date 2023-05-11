const bcrypt = require("bcryptjs");

bcrypt.hash("Password@123", 10).then((h) => console.log(h));
