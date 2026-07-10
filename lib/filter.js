// Location gate. Runs in plain code BEFORE any Anthropic call so out of area
// postings cost zero tokens. A job survives only if it is in the NWA area,
// in commutable Southwest Missouri, or explicitly remote (location field or
// title, not description, because onsite postings mention the word remote in
// body text all the time).

// Ambiguous city names (Rogers, Springdale, Fayetteville, Lowell, and others
// exist in multiple states) require their state alongside. AR is matched as
// ", AR" or "Arkansas"; MO as ", MO" or "Missouri".
const AR = "(,?\\s*(ar|arkansas))";
const MO = "(,?\\s*(mo|missouri))";

const AREA_PATTERNS = [
  // Northwest Arkansas
  new RegExp("bentonville" + AR + "?", "i"),
  new RegExp("centerton" + AR + "?", "i"),
  new RegExp("siloam springs" + AR + "?", "i"),
  new RegExp("tontitown" + AR + "?", "i"),
  new RegExp("\\brogers\\b" + AR, "i"),
  new RegExp("springdale" + AR, "i"),
  new RegExp("fayetteville" + AR, "i"),
  new RegExp("\\blowell\\b" + AR, "i"),
  new RegExp("bella vista" + AR, "i"),
  new RegExp("pea ridge" + AR + "?", "i"),
  new RegExp("gravette" + AR + "?", "i"),
  new RegExp("gentry" + AR, "i"),
  new RegExp("cave springs" + AR + "?", "i"),
  new RegExp("elm springs" + AR + "?", "i"),
  new RegExp("prairie grove" + AR, "i"),
  new RegExp("farmington" + AR, "i"),
  new RegExp("johnson" + AR, "i"),
  new RegExp("elkins" + AR, "i"),
  // Southwest Missouri (commutable from Bella Vista)
  new RegExp("joplin" + MO + "?", "i"),
  new RegExp("neosho" + MO + "?", "i"),
  new RegExp("carthage" + MO, "i"),
  new RegExp("monett" + MO + "?", "i"),
  new RegExp("cassville" + MO + "?", "i"),
  new RegExp("pineville" + MO, "i"),
  new RegExp("anderson" + MO, "i"),
  new RegExp("\\bnoel\\b" + MO, "i"),
  new RegExp("goodman" + MO, "i"),
  new RegExp("\\bjane\\b" + MO, "i"),
  new RegExp("webb city" + MO + "?", "i"),
];

const REMOTE_PATTERN = /\bremote\b|\bwork from home\b|\bwfh\b/i;

export function isInArea(job) {
  const loc = job.location || "";
  return AREA_PATTERNS.some((p) => p.test(loc));
}

export function isRemote(job) {
  return REMOTE_PATTERN.test(job.location || "") || REMOTE_PATTERN.test(job.title || "");
}

export function locationGate(jobs) {
  const kept = [];
  let dropped = 0;
  for (const job of jobs) {
    if (isInArea(job) || isRemote(job)) {
      kept.push(job);
    } else {
      dropped += 1;
    }
  }
  return { kept, dropped };
}
