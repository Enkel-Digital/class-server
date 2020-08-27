const express = require("express");
const router = express.Router();
const db = require("./../utils/db.js");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// const { getStripePartnerID } = require("../db/getPartner");

// @todo This might be an issue if customer is deleted on stripe but not deleted from database.
async function partnerExists(partnerID) {
  return Boolean(
    (
      await db
        .collection("billingPartnerAccounts")
        .doc(partnerID.toString()) // As userAccountID is a number, WE MUST CONVERT it to string first, as firestore NEEDS string for document path!!!
        .get()
    ).data()
  );
}
async function getStripePartnerID(partnerAccountID) {
  const snapshot = await db
    .collection("billingPartnerAccounts")
    .doc(partnerAccountID.toString())
    .get();

  if (snapshot.empty) return;

  return snapshot.data().partnerID;
}

/**
 * Checks if partner object exists for this partnerID
 * @name GET /partner/exists/:partnerID
 * @returns {object} Boolean
 */
router.get("/exists/:partnerID", async (req, res) => {
  try {
    const { partnerID } = req.params;

    return res
      .status(200)
      .json({ success: true, exists: await partnerExists(partnerID) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a new partner Connect account
 * @name POST /partner
 * @param {string} country  country of the partner business
 * @param {string} email    email of the partner
 * @param {string} businessType business type of the partner
 * @param {string} company info of the partner company or business
 * @param {string} individual info of the person represented by the account
 * @returns {object} Boolean
 */
router.post("/", express.json(), async (req, res) => {
  try {
    const {
      partnerID,
      country,
      email,
      businessType,
      // company,
      // individual,
    } = req.body;

    const accountType = "standard";
    const account = await stripe.accounts.create({
      type: accountType,
      country: country,
      email: email,
      business_type: businessType,
    });

    await db
      .collection("billingPartnerAccounts")
      .doc(partnerID.toString()) // As partnerID is a number, WE MUST CONVERT it to string first, as firestore NEEDS string for document path!!!
      .set({ partnerID: account.id });

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create an account link
 * @name POST /partner/link/:partnerID
 * @param {string} account the identifier of the account to create an account link for.
 * @param {string} refresh_url The URL that the user will be redirected to if the account link is no longer valid.
 * @param {string} return_url the URL that the user will be redirected to upon leaving or completing the linked flow.
 * @param {string} type The type of account link the user is requesting. Possible values are account_onboarding or account_update.
 * @returns {object} Boolean
 */
router.post("/link/:partnerID", express.json(), async (req, res) => {
  try {
    // eslint-disable-next-line camelcase
    const { refresh_url, return_url, type } = req.body;
    const { partnerID } = req.params;
    const stripePartnerID = await getStripePartnerID(partnerID);

    const accountLink = await stripe.accountLinks.create({
      account: stripePartnerID,
      refresh_url: "https://google.com",
      return_url: "https://youtube.com",
      type: "account_onboarding",
    });

    res.status(201).json({ success: true, url: accountLink.url });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create an account link to update partner info
 * @name POST /partner/link/:partnerID
 * @param {string} account the identifier of the account to create an account link for.
 * @param {string} refresh_url The URL that the user will be redirected to if the account link is no longer valid.
 * @param {string} return_url the URL that the user will be redirected to upon leaving or completing the linked flow.
 * @param {string} type The type of account link the user is requesting. Possible values are account_onboarding or account_update.
 * @returns {object} Boolean
 */
router.post("/link/update/:partnerID", express.json(), async (req, res) => {
  try {
    // eslint-disable-next-line camelcase
    const { refresh_url, return_url, type } = req.body;
    const { partnerID } = req.params;
    const stripePartnerID = await getStripePartnerID(partnerID);

    const accountLink = await stripe.accountLinks.create({
      account: stripePartnerID,
      refresh_url: "https://google.com",
      return_url: "https://youtube.com",
      type: "account_update",
    });

    res.status(201).json({ success: true, url: accountLink.url });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
