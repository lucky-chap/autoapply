# AutoApply Job Board API Integrations Plan

## Overview
The API integrations address the "find jobs for me" flow. Instead of the user actively browsing, the system searches for jobs matching the user's preferences, evaluates them, and automatically initiates applications.

## Core Functionality
- **Automated Sourcing**: Periodically poll open job board APIs for new listings that match the user's `targetRoles`, `targetLocations`, and `minSalary`.
- **Filtering & Matching**: Evaluate the fetched job descriptions against the user's resume using an LLM to determine fit and ensure it's not a generic/spam listing.
- **Application Routing**: 
  - If the API provides a direct application email, automatically route it through the existing email pipeline (Pending Action -> Approval -> Sent).
  - If the API only provides a URL to an ATS (Greenhouse/Lever), queue the job in the user's dashboard to be handled by the Chrome Extension.

## Supported Platforms (Phase 1)
Since major platforms (LinkedIn, Indeed) have closed or highly restricted APIs, we will focus on aggregator APIs and developer-friendly job boards:
1. **Adzuna API**: Huge aggregator covering multiple countries. Good for general tech roles.
2. **Remotive API**: Excellent for remote-first tech and startup jobs. Completely open API.
3. **Arbeitnow API**: Open API focused on tech jobs, many with direct application links.
4. **Himalayas API**: Another great remote job board with a public API.

## System Architecture

### Backend (Convex)
- **Cron Jobs**: Implement a Convex scheduled function (`crons.interval`) that runs every X hours to poll the integrated APIs.
- **Data Models**:
  - `jobListings`: A new table to cache fetched jobs to prevent duplicate processing.
  - `userJobMatches`: A table linking users to fetched jobs, tracking the status (e.g., `ignored`, `pending_approval`, `applied`).
- **Processing Pipeline**:
  1. Fetch jobs from external APIs based on aggregated user preferences.
  2. Normalize the data into a standard `JobListing` schema.
  3. Filter out duplicates and previously seen jobs.
  4. Per user, run an AI evaluation: Does `JobListing.description` match `UserProfile.resume`?
  5. If YES -> Create an application draft in the user's Kanban board.

## Implementation Phases

### Phase 1: Sourcing & Storage Infrastructure
- Create the necessary Convex tables (`jobListings`, `userJobMatches`).
- Build a generic fetching framework to handle pagination, rate limiting, and generic data normalization across different API providers.
- Implement the first integration: **Remotive API** (easiest to start with).
- Set up the Convex Cron job to fetch daily for active users.

### Phase 2: AI Matching Engine
- Implement the matching logic: When new jobs are fetched, trigger an AI action that compares the job description against the user's uploaded resume and preferences.
- Define a strict scoring threshold to prevent spamming the user's dashboard with irrelevant jobs.
- If a job passes the threshold, insert it into the user's application tracker as "Discovered/To Apply".

### Phase 3: Multi-Provider Expansion
- Add integrations for Adzuna, Arbeitnow, and Himalayas.
- Implement webhooks (if provided by the job boards) as an alternative to polling.
- Add UI to the dashboard allowing users to fine-tune their API search queries (e.g., exclude certain companies, require specific keywords).

## Known Challenges
1. **API Rate Limits**: Aggregating searches for many users could hit API rate limits quickly. We need to deduplicate searches (e.g., search "Frontend Engineer Remote" once globally, not per-user).
2. **Quality of Listings**: Aggregators often include stale, fake, or heavily recruiter-spam jobs. The AI matching engine needs to be highly tuned to discard garbage listings.
3. **Application Execution**: Many APIs only return a generic `apply_url`. We still need the Chrome Extension (or a headless browser like Puppeteer) to actually complete the application if it's not an email-based application.
