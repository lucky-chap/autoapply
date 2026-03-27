# AutoApply Chrome Extension Plan

## Overview
The AutoApply Chrome extension addresses the "I found a job I like" flow. It allows users browsing job sites (LinkedIn, Indeed, Greenhouse, etc.) to trigger AutoApply directly from the page.

## Core Functionality
The extension will operate in two distinct modes depending on the job site's structure:

### 1. Email Mode (Direct Contact)
For job postings that include a direct recruiter email or a `mailto:` link (common on startup boards like AngelList, Remotive, and some ATS pages).
- **Scraping**: Extract job title, company name, job description, and the recruiter's email address.
- **Action**: Send this structured data to the Convex backend to generate a tailored cover letter and dispatch the application via the existing email pipeline.

### 2. Form-Fill Mode (ATS Integration)
For multi-step application forms (e.g., LinkedIn Easy Apply, Workday, Greenhouse, Lever, iCIMS).
- **Scraping**: Extract job title, company, and description.
- **Generation**: Push the job description to the Convex backend to generate a personalized cover letter and fetch the user's base resume.
- **Auto-Fill**: Parse the DOM of the active ATS form and inject the user's data (name, email, phone, generated cover letter, and resume file).
- **Complexity Note**: DOM structures vary wildly between ATS providers and change frequently. We will need specific parsers/adapters for major platforms (Greenhouse, Lever) first before attempting universal autofill.

## System Architecture

### Frontend (Extension Content Script & Popup)
- **Framework**: React + Vite (CRXjs for Chrome extension bundling)
- **UI (Popup)**: A clean popup showing connection status to the Convex backend, the current job detected on the page, and an "AutoApply" button.
- **Content Script**:
  - Detects the current ATS/Job Board based on URL patterns.
  - Injects a floating "Apply with AutoApply" button onto supported job pages.
  - Handles DOM parsing to scrape job descriptions.
  - Handles DOM interaction to fill forms.

### Backend (Convex)
- **New Endpoints**:
  - `POST /api/extension/parse-job`: Accepts raw DOM/text, uses LLM to extract structured job data, returns generated cover letter text and resume details.
  - `POST /api/extension/submit-email-app`: Triggers the existing email pipeline for "Email Mode" jobs.
- **Authentication**: The extension needs to authenticate with the Convex backend. We can use Auth0 Device Flow or passing a secure token from the main web app to the extension via `postMessage` or local storage sharing.

## Implementation Phases

### Phase 1: Foundation & "Email Mode"
- Scaffold the extension using Vite + CRXjs.
- Implement authentication linking between the extension and the user's AutoApply account.
- Build the popup UI and the underlying Convex API endpoints to receive scraped data.
- **Target**: Sites with visible recruiter emails. The extension scrapes the page, finds the email, and triggers the existing backend email flow.

### Phase 2: Form-Fill Mode (Greenhouse & Lever)
- Implement AST/DOM adapters specifically for Greenhouse and Lever (the most predictable modern ATS platforms).
- Build the two-way sync: Extension scrapes description -> Backend generates cover letter -> Extension receives text and auto-fills the `textarea`.
- Implement basic field auto-fill for standard inputs (First Name, Last Name, Email, LinkedIn URL).

### Phase 3: Advanced Form-Fill & LinkedIn Easy Apply
- Tackle LinkedIn Easy Apply (requires handling multi-page SPA forms and React internal state injection).
- Implement file upload handling (passing the resume PDF from the backend to the browser's `FileList` object to attach to file inputs).
- Add telemetry to detect when job board layouts change and break existing adapters.

## Known Challenges
1. **DOM Instability**: Job boards frequently change class names and structures, breaking scrapers.
2. **File Uploads in Extensions**: Programmatically setting the value of an `<input type="file">` in a content script is restricted by browser security policies. We may need to use background service workers or CDP (Chrome DevTools Protocol) workarounds.
3. **Session Management**: Keeping the extension authenticated securely without forcing the user to log in repeatedly.
