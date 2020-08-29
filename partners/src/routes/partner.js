/**
 * Express Router for partner related routes.
 * Mounted on /partner
 * @author JJ
 * @module Partner routes
 */

const express = require("express");
const router = express.Router();
const SQLdb = require("@enkeldigital/ce-sql");
const getPartnerTags = require("../db/getPartnerTags");
const sendMail = require("../utils/sendMail");

const createLogger = require("@lionellbriones/logging").default;
const logger = createLogger("routes:partner");

/**
 * Get partner details with its tags
 * @name GET /partner/:partnerID
 * @returns {object} Partner object
 */
router.get("/:partnerID", async (req, res) => {
  try {
    const { partnerID } = req.params;

    const partner = await SQLdb("partners")
      .where({ id: partnerID })
      .where("deleted", false)
      .first();

    if (!partner)
      return res.status(404).json({ success: false, error: "No such Partner" });

    // @todo Can we achieve this using a SQL JOIN?
    // Inject partnerTags in as an array
    partner.tags = await getPartnerTags(partnerID);

    res.json({ success: true, partner });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update partner details
 * @todo Only admins can do this
 * @name PATCH /partner/:partnerID
 * @function
 * @param {object} partner
 * @returns {object} Success indicator
 */
router.patch("/:partnerID", express.json(), async (req, res) => {
  try {
    const { partnerID } = req.params;
    const { partner } = req.body;

    await SQLdb("partners").where({ id: partnerID }).update(partner);

    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * "Delete" partner / business organization profile, and with it, all partnerAccounts and classes belonging to this partner.
 * @todo Only admins can do this
 * @name DELETE /partner/:partnerID
 * @function
 * @param {object} partner
 * @returns {object} Success indicator
 */
router.delete("/:partnerID", express.json(), async (req, res) => {
  try {
    const { partnerID } = req.params;

    await SQLdb("partners").where({ id: partnerID }).update({ deleted: true });

    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create new partner / business organization
 * @todo DOES NOT have auth token requirement, but should be rate limited (with IP / through unique email and phone verification)
 * @name POST /partner/new/
 * @param {Object} partner
 * @param {Object} accountCreationRequest
 * @returns {object} success indicator
 */
router.post("/new", express.json(), async (req, res) => {
  try {
    const { accountCreationRequest, partner } = req.body;

    // @todo Better verification
    if (!partner) throw new Error("Missing 'partner' data");
    if (!accountCreationRequest)
      throw new Error("Missing 'owner account' data");

    const validateURL = require("../validations/isHTTPS");

    if (!validateURL(partner.website))
      throw new Error("Website URL should be HTTPS only");

    // Insert partner details alongside data from accountCreationRequest into temporary DB, for CE admins to verify
    await SQLdb("new_partners").insert({
      ...partner,
      createdByName: accountCreationRequest.name,
      createdByEmail: accountCreationRequest.email,
    });

    // Create a HTML list for the details to send to CE admins for us to verify
    const htmlDetails =
      "<ul>" +
      Object.entries(partner)
        .map(([key, value]) => `<li>${key}: ${value}</li>`)
        .join("") +
      "</ul>";

    // Notify the CE admins
    // @todo Replace with teletif
    await sendMail({
      // @todo Replace domain once fixed
      to: "classexpress@enkeldigital.com",
      from: "Accounts@classexpress.com",
      subject: `New ClassExpress partner ${partner.name}`,
      // @todo Use a sendgrid template instead
      html:
        `A new ClassExpress partner has been registered and is now waiting for verification.<br />` +
        "Here are the details.<br />" +
        "<br />" +
        htmlDetails,
      // @todo Perhaps add link to allow us to verify directly or smth?
      // @todo This part should be replaced by an Admin panel
    });

    // Send email to the company email address to let them know that verification is in progress
    await sendMail({
      to: partner.companyEmail,
      from: "Accounts@classexpress.com",
      subject: `ClassExpress partner registration for ${partner.name}`,
      // @todo Use a sendgrid template instead
      html:
        `A new ClassExpress partner has been registered and is now waiting for verification.<br />` +
        "Here are the details.<br />" +
        "<br />" +
        htmlDetails,
    });

    // Notify the business owner that their business is awaiting verification, and they will get another email for signup once verified
    await sendMail({
      to: accountCreationRequest.email,
      from: "Accounts@classexpress.com",
      subject: `Hi ${accountCreationRequest.name}, we received ${partner.name}'s ClassExpress partner registration`,
      // @todo Use a sendgrid template instead
      html:
        `This email is to inform you that the registration and verification process for your ClassExpress partner has began.<br />` +
        "Sit tight for now! We will be in contact with you shortly and inform you if there is any things else we need from you.<br />" +
        "Once your business is verified, we will send this email a link to create an admin account for the business.<br />" +
        "<br />" +
        // @todo Replace the domain once it has been set
        "Thank you so much for choosing us! If you need any further assistance, please contact us <a href='mailto:admin@enkeldigital.com'>here</a>.<br />",
    });

    res.status(201).json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
