// Scoring layer. The model call is injected so the same code runs in
// production (real Anthropic call) and in offline tests (stubbed response).

export const SCORE_SYSTEM_PROMPT = `You score job postings against one candidate's profile. Output ONLY valid JSON, no preamble, no markdown fences.

CANDIDATE PROFILE:
Supply chain and logistics professional, 20 plus years, most recent title Business Analyst II. Strengths: Excel, Power BI (proficient), SQL, Google BigQuery, Workday ERP, TMS, WMS, Retail Link, Walmart ecosystem fluency. Core wins: about 2.3M dollars freight claims reduction, WMS migration data integrity, dedicated fleet startup. Target roles: replenishment manager, inventory management, supply chain analyst, demand planning, logistics ops. Target locations: Northwest Arkansas (Bentonville, Rogers, Springdale, Bella Vista) and remote.

HONESTY CONSTRAINTS (used to flag, not to filter silently):
- The candidate translates retailer provided projections into replenishment plans. He does NOT independently build statistical forecast models. Flag any role whose core requirement is building statistical or ML forecasting models from scratch.
- The candidate does not claim Tableau or VBA. Flag roles that require either as a hard qualification.

For the posting provided, return JSON with exactly these keys:
{
  "fit_score": integer 0 to 100,
  "title_match": integer 0 to 100,
  "skill_match": integer 0 to 100,
  "seniority_fit": "below" or "match" or "above",
  "location_fit": "onsite_nwa" or "remote" or "out_of_area",
  "honesty_flags": [array of short strings, empty if none],
  "reasons": "2 sentences, plain language",
  "recommend": true or false
}`;

export function buildUserContent(job) {
  return [
    "Title: " + job.title,
    "Company: " + job.company,
    "Location: " + job.location,
    "Description: " + (job.description || "").slice(0, 1500),
  ].join("\n");
}

// Pull a JSON object out of model text even if it wraps it in fences or prose.
export function extractJson(text) {
  if (!text) return null;
  let cleaned = String(text).replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (err) {
    return null;
  }
}

// callModel(systemPrompt, userContent) resolves to the raw model text.
export async function scoreJobs(jobs, callModel) {
  const scored = [];
  for (const job of jobs) {
    let result = null;
    try {
      const text = await callModel(SCORE_SYSTEM_PROMPT, buildUserContent(job));
      result = extractJson(text);
    } catch (err) {
      result = null;
    }
    if (!result) {
      scored.push({ ...job, score: null, scoreError: true });
      continue;
    }
    scored.push({ ...job, score: result, scoreError: false });
  }
  return scored;
}

export function rankJobs(scoredJobs) {
  const score = (j) => (j.score && typeof j.score.fit_score === "number" ? j.score.fit_score : -1);
  const recommended = (j) => (j.score && j.score.recommend ? 1 : 0);
  const posted = (j) => (j.posted_at ? Date.parse(j.posted_at) || 0 : 0);
  return [...scoredJobs].sort((a, b) => {
    if (recommended(b) !== recommended(a)) return recommended(b) - recommended(a);
    if (score(b) !== score(a)) return score(b) - score(a);
    return posted(b) - posted(a);
  });
}
