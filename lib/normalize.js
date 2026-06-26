// Turns the three different source response shapes into one common schema,
// then removes overlapping postings that appear in more than one source.

function cleanText(value) {
  if (!value) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function dedupeKey(job) {
  return [job.title, job.company, job.location]
    .map((part) => cleanText(part).toLowerCase())
    .join("|");
}

// JSearch (RapidAPI) returns an array under data.data
export function normalizeJSearch(payload) {
  const rows = (payload && payload.data) || [];
  return rows.map((r) => ({
    id: cleanText(r.job_id),
    title: cleanText(r.job_title),
    company: cleanText(r.employer_name),
    location: cleanText(
      [r.job_city, r.job_state].filter(Boolean).join(", ") || r.job_country
    ),
    posted_at: r.job_posted_at_datetime_utc || null,
    url: cleanText(r.job_apply_link),
    description: cleanText(r.job_description).slice(0, 1500),
    source: "jsearch",
  }));
}

// Adzuna returns an array under results
export function normalizeAdzuna(payload) {
  const rows = (payload && payload.results) || [];
  return rows.map((r) => ({
    id: cleanText(r.id),
    title: cleanText(r.title),
    company: cleanText(r.company && r.company.display_name),
    location: cleanText(r.location && r.location.display_name),
    posted_at: r.created || null,
    url: cleanText(r.redirect_url),
    description: cleanText(r.description).slice(0, 1500),
    source: "adzuna",
  }));
}

// Workday cxs endpoint returns jobPostings with a relative externalPath
export function normalizeWorkday(payload, companyName, baseUrl) {
  const rows = (payload && payload.jobPostings) || [];
  return rows.map((r) => ({
    id: cleanText(r.externalPath),
    title: cleanText(r.title),
    company: cleanText(companyName),
    location: cleanText(r.locationsText),
    posted_at: r.postedOn || null,
    url: cleanText(baseUrl) + cleanText(r.externalPath),
    description: cleanText((r.bulletFields || []).join(" ")).slice(0, 1500),
    source: "workday",
  }));
}

// Keep the first time a job is seen, but record every source it came from.
export function dedupe(jobs) {
  const seen = new Map();
  for (const job of jobs) {
    const key = dedupeKey(job);
    if (!key || key === "||") continue;
    if (seen.has(key)) {
      const kept = seen.get(key);
      if (!kept.sources.includes(job.source)) kept.sources.push(job.source);
      continue;
    }
    seen.set(key, { ...job, sources: [job.source] });
  }
  return Array.from(seen.values());
}
