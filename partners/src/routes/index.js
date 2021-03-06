/** @notice Parent router where all other routers are mounted onto. */
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

// Mount all the routes onto their respective base routes
router.use("/", require("./default"));
router.use("/class", require("./class"));
router.use("/partner", require("./partner"));
router.use("/user", auth, require("./users"));
router.use("/tags/class", require("./classTags"));
router.use("/tags/partner", require("./partnerTags"));
router.use("/favourites", auth, require("./favourites"));
router.use("/subscription", require("./subscription"));
router.use("/points", auth, require("./points"));
router.use("/reviews", require("./reviews"));
router.use("/settings", auth, require("./settings"));
router.use("/emailActionLinks", require("./emailActionLinks"));
router.use("/employees", require("./employees"));
router.use("/bookings", require("./bookings"));
router.use("/partner/new", require("./newPartner"));
router.use("/employees/new", require("./newPartnerAccount"));

module.exports = router;
