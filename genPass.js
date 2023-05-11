const bcrypt = require("bcryptjs");
bcrypt.hash("admin@p24x7", 10).then((hash) => console.log(hash));
