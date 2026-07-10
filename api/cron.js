import { fetchAllJobs } from "./fetch-jobs.js";
import { scoreJobs, rankJobs } from "../lib/score.js";
import { makeAnthropicCaller } from "../lib/anthropic.js";
import { storeJobs, getKnownUrls } from "../lib/store.js";

// Triggered by Vercel Cron once a day (see vercel.json). Fetches every source,
// drops out of area postings in code (free), skips anything already scored on
// a previous run (free), and only then scores the remainder with Haiku.
export default async function handler(req, res) {
  try {
    const { jobs, dropped } = await fetchAllJobs();
    const known = await getKnownUrls();
    const fresh = jobs.filter((j) => !known.has(j.url));

    const callModel = makeAnthropicCaller("claude-haiku-4-5-20251001");
    const scored = await scoreJobs(fresh, callModel);
    const ranked = rankJobs(scored);
    const result = await storeJobs(ranked);

    res.status(200).json({
      fetched: jobs.length,
      dropped_out_of_area: dropped,
      already_scored: jobs.length - fresh.length,
      scored: ranked.length,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
