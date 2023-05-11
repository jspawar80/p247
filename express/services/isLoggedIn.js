const { Router } = require("express");
const jwt = require("../middlewares/jwt");

const router = Router();

//following route is used to check if the user is logged in or not
router.get("/", jwt, (req, res) => {
  console.log(req.user);
  req.user ? res.status(200).json({ user: req.user }) : res.status(401);
});

module.exports = router;
