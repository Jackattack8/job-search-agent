// Scoring layer. The model call is injected so the same code runs in
// production (real Anthropic call) and in offline tests (stubbed response).

export const SCORE_SYSTEM_PROMPT = `You score job postings against one candidate's profile. Output ONLY valid JSON, no preamble, no markdown fences.

CANDIDATE PROFILE:
Supply chain and logistics professional, 20 plus years, most recent title Business Analyst II. Strengths: Excel, Power BI (proficient), SQL, Google BigQuery, Workday ERP, TMS, WMS, Retail Link, Walmart ecosystem fluency. Core wins: about 2.3M dollars freight claims reduction, WMS migration data integrity, dedicated fleet startup. Target roles: replenishment manager, inventory management, supply chain analyst, demand planning, logistics ops. Target locations: Northwest Arkansas (Bentonville, Rogers, Springdale, Bella Vista) and remote.

HONESTY CONSTRAINTS (used to flag, not to filter silently):
- The candidate translates retailer provided projections into replenishment plans. He does NOT independently build statistical forecast models. Flag any role whose core requirement is building statistical or ML forecasting models from scratch.
- The candidate does not claim Tableau or VBA. Flag roles that require either as a hard qualification.

SCORING ADJUSTMENTS
Apply these after your initial read of the job description, before producing the final score. They correct for two failure modes: crediting vocabulary overlap as function fit, and treating preferred qualifications as optional regardless of seniority.

Function match vs vocabulary match.
The candidate's career is carrier side and transportation side: freight, dedicated fleet operations, logistics analytics, and transportation business analysis. It is NOT supplier side retail replenishment, demand planning, merchandising, or category management.
First identify the job's PRIMARY function from its core responsibilities, not from shared supply chain vocabulary. Weight the first three or four responsibility bullets most heavily. Then classify the overlap:
- Direct function match: primary function is transportation, freight, logistics ops, or logistics and transportation analytics. No penalty.
- Adjacent function: supply chain analytics broadly where transportation experience transfers cleanly (network analysis, supply chain reporting, ops analytics). Penalty of 0 to 5 points.
- Cross function: primary function is supplier replenishment, demand or supply planning, statistical forecasting, inventory planning into a retailer, merchandising, or buying. Apply a penalty of 15 to 25 points even when supply chain, Walmart, in stock, scorecard, and Excel vocabulary overlap heavily.
Heavy keyword overlap is expected for cross function roles in the NWA supplier ecosystem and must not offset this penalty. Overlapping terms describe the same industry, not the same job.

Seniority sensitivity on preferred qualifications.
Scan the title for Senior, Sr, Lead, Principal, Manager, or Director. If present, treat preferred or nice to have qualifications as load bearing, not optional:
- Retailer systems named as preferred (Retail Link, NOVA, Madrid, GRS, JDA, Blue Yonder, SAP) count as effectively required at senior level. Missing all of them: penalty of 8 to 12 points.
- Mentoring, leading analysts, or subject matter expert language at senior level assumes the candidate has already done the non senior version of the same function. If the candidate has not held that function at any level, penalty of 5 to 10 points.
For non senior titles, score preferred items as genuine nice to haves with little or no penalty.

Honesty boundary requirements (do not credit).
The candidate translates retailer provided projections into replenishment and execution plans. He does NOT independently build statistical forecast models, and does not claim Tableau, VBA, SAP, OTIF, case fill, POS metrics, or demand planning platforms. If the job requires developing statistical forecast models, owning a demand planning platform, or any of those tools, do NOT score it as a match because the word forecast or analytics appears in the candidate's background. Treat each as an unmet requirement and add it to honesty_flags.

For the posting provided, return JSON with exactly these keys:
{
  "fit_score": integer 0 to 100,
  "title_match": integer 0 to 100,
  "skill_match": integer 0 to 100,
  "seniority_fit": "below" or "match" or "above",
  "location_fit": "onsite_nwa" or "remote" or "out_of_area",
  "primary_function": one of "transportation", "logistics_ops", "supply_chain_analytics", "replenishment", "demand_planning", "forecasting", "merchandising", "other",
  "function_match": one of "direct", "adjacent", "cross",
  "honesty_flags": [array of short strings, empty if none],
  "reasons": "2 sentences in plain language that name the function penalty and the seniority penalty you applied",
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
