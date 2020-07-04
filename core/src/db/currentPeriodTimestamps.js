/**
 * Abstractions over SQL db for getting timestamps for the start and end of user's current period
 * @author JJ
 */

const moment = require("moment");
const unixseconds = require("unixseconds");
const { getCurrentPlan } = require("./getPlans");

// 30 Days in seconds
const periodLengthInSeconds = 30 * 24 * 60 * 60; // 30 days, 24 hours, 60 mins, 60 seconds

/**
 * For params, either provide usersCurrentPlan or userID and nowTS to get the user's current plan
 */
async function getStartOfCurrentPeriod({
  usersCurrentPlan,
  userID,
  nowTS = unixseconds(),
}) {
  if (!usersCurrentPlan) usersCurrentPlan = await getCurrentPlan(userID, nowTS);

  // Calculate total number of periods excluding current period, to get timestamp of the start of current period
  return moment
    .unix(usersCurrentPlan.start)
    .add(
      Math.floor((nowTS - usersCurrentPlan.start) / periodLengthInSeconds) * 30,
      "days"
    )
    .unix();
}

/**
 * For params, either provide usersCurrentPlan or userID and nowTS to get the user's current plan
 */
async function getEndOfCurrentPeriod({
  usersCurrentPlan,
  userID,
  nowTS = unixseconds(),
}) {
  if (!usersCurrentPlan) usersCurrentPlan = await getCurrentPlan(userID, nowTS);

  // Calculate total number of periods including current period, to get the timestamp of end of current period
  return moment
    .unix(usersCurrentPlan.start)
    .add(
      Math.ceil((nowTS - usersCurrentPlan.start) / periodLengthInSeconds) * 30,
      "days"
    )
    .unix();
}

module.exports = {
  getStartOfCurrentPeriod,
  getEndOfCurrentPeriod,
};
