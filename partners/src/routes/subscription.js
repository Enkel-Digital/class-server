/**
 * Express Router for subscription related routes
 * Mounted on /subscription
 * @author JJ
 * @module Subscription routes
 */

const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const onlyOwnResource = require("../middleware/onlyOwnResource");
const SQLdb = require("@enkeldigital/ce-sql");

const createLogger = require("@lionellbriones/logging").default;
const logger = createLogger("routes:subscription");
const moment = require("moment");
const unixseconds = require("unixseconds");

/**
 * Get subscriptionplans
 * @name GET /subscription/plans/all
 * @returns {object} List of subscription plans
 */
router.get("/plans/all", async (req, res) => {
  try {
    const subscriptionPlans = await SQLdb("subscriptionPlans")
      .where({
        // Allow us to run campaigns for subscription plans
        available: true,
        // Allow to select only plans valid for user's country.
        // countryCode: "SG",
      })
      .orderBy("price", "asc")
      .select("id", "name", "copywriting", "currency", "price", "totalPoints");

    res.json({ success: true, subscriptionPlans });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const periodLengthInSeconds = 30 * 24 * 60 * 60; // 30 days, 24 hours, 60 mins, 60 seconds

// @todo Refactor out so that points API can use this
function getCurrentPlan(userID, nowTS) {
  return SQLdb("userPlans")
    .where({ userID })
    .where("start", "<=", nowTS) // If already started. // Using <= instead of < as update can be done in the same second
    .where(function () {
      // And doesnt have a end date Or if the end date is past the current date
      this.whereNull("end").orWhere("end", ">", nowTS);
    })
    .first(); // Although always be 1, first is still used to get object form instead of a 1 element array
}

function getNextPlan(userID, nowTS) {
  return SQLdb("userPlans")
    .where({ userID })
    .where("start", ">", nowTS) // Where plan has yet to start
    .first(); // Although always be 1, first is still used to get object form instead of a 1 element array
}

async function getPlans(userID) {
  // Call once to pass currentPlan and nextPlan the same timestamp value for consistent filtering.
  const nowTS = unixseconds();

  return {
    // If none, undefined will be returned
    current: await getCurrentPlan(userID, nowTS),
    next: await getNextPlan(userID, nowTS),
  };
}

/**
 * Get users' subscription plan
 * @name GET /subscription/:userID
 * @returns {object} Full Subscription plan objects if any
 */
router.get("/:userID", auth, onlyOwnResource, async (req, res) => {
  try {
    const { userID } = req.params;

    return res.status(200).json({
      success: true,
      plans: await getPlans(userID),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update or purchase plans
 * @name POST /subscription/plans/update
 * @param {String} userID
 * @param {String} subscriptionPlanID
 * @returns {object} success indicator
 */
router.post(
  "/plans/update",
  auth,
  onlyOwnResource,
  express.json(),
  async (req, res) => {
    try {
      const { userID, subscriptionPlanID } = req.body;

      // Ensure planID is valid, even though a bad insert will also throw, but doing this check for consistency
      if (
        !(await SQLdb("subscriptionPlans")
          .where({ id: subscriptionPlanID })
          .first())
      )
        return res
          .status(400)
          .json({ success: false, error: "Invalid subscriptionPlanID" });

      // Call once to pass currentPlan and nextPlan the same value for each API call
      const nowTS = unixseconds();

      // Get user's plans
      const currentPlan = await getCurrentPlan(userID, nowTS);
      const nextPlan = await getNextPlan(userID, nowTS);

      // If user already have a currentPlan
      if (currentPlan) {
        // If user already have next plan, replace next plan's planID with new planID
        if (nextPlan) {
          // If user sets next plan back to the same as the current plan, delete next plan and set end of life of current plan to null again
          if (subscriptionPlanID === currentPlan.planID) {
            await getNextPlan(userID, nowTS).del();
            // Remove end of life of current plan by setting end to null
            await getCurrentPlan(userID, nowTS).update({ end: null });
          }
          // Else, just update planID of next plan
          else
            await getNextPlan(userID, nowTS).update({
              planID: subscriptionPlanID,
            });

          // @todo Call billing service to update
        }
        // Else if no next plan and new plan is the same as current plan, ignore it
        else if (currentPlan.planID === subscriptionPlanID) {
          // If have next plan alr, but new plan is same as old plan. delete next plan and change back to null for end
          // @todo This dont need to call Billing Service
        }
        // Else if no next plan, and selected plan is a new plan, set end of life for current plan and insert new plan record.
        else {
          // Calculate total number of periods including current period, to get the timestamp of end of current period
          const endOfCurrentPeriod = moment
            .unix(currentPlan.start)
            .add(
              Math.ceil((nowTS - currentPlan.start) / periodLengthInSeconds) *
                30,
              "days"
            )
            .unix();

          // Update user's current plan to end after their current period
          await getCurrentPlan(userID, nowTS).update({
            end: endOfCurrentPeriod,
          });

          // Set user's next plan
          await SQLdb("userPlans").insert({
            userID,
            planID: subscriptionPlanID,
            // Start of next period === end of current period
            // @todo Should this be +1 second instead?
            start: endOfCurrentPeriod,
          });
        }

        // @todo Then update the Billing service and get back a resp
        // I should call billing service first. Only when it confirms, with a webhook, then i update the value in DB
        // Actually only call billing service first if first plan, where user have to pay first.
        // if user alr has a plan and wanna change next plan, we just need to update billing service in the background to update stripe
      }
      // If user does not have a plan, as no current plan and no next plan
      else if (!nextPlan) {
        // Set user's current plan
        await SQLdb("userPlans").insert({
          userID,
          planID: subscriptionPlanID,
          // @todo Should it be now? Or at midnight?
          start: nowTS,
          end: null,
        });
      } else {
        // @todo To handle this case
        return res.json({ success: false, error: "CASE TOO BE HANDLED" });
      }

      // Respond with the plans too for client to use as point of truth
      res.json({
        success: true,
        plans: await getPlans(userID),
      });

      // // Send user a email notification once subscription is updated
      // await sendMail({
      //   to: data.email,
      //   from: "billing@classexpress.com", // @todo Update this value and move it to a config file
      //   subject: "Successfully updated subscription plan!",
      //   html:
      //     `Request for subscription plan received<br />${new Date()}` +
      //     `<br />Email: ${data.email}<br />Name: ${data.name}<br />` +
      //     "New subscription plan will start from ... to ..."
      // });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Request to cancel subscription plan
 * @name POST /subscription/cancel
 * @returns {object} success indicator
 */
router.post("/cancel", auth, async (req, res) => {
  try {
    // Update subscription collection's document to set next month planID to null

    // Set a end date for the current plan.
    // If there is a next plan. Delete that document. Or make its start and end null to indicate nvr ran.
    // await db.collection("users").doc(userID).update({
    //   modifiedAt: FieldValue.serverTimestamp(),
    //   nextPlanID: null,
    // });

    // Call Billing Service to cancel

    res.json({ success: true });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
