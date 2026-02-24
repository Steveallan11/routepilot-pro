# RoutePilot Pro — TODO

## Phase 1: Scaffold
- [x] Design system: dark theme, color palette, typography, global CSS
- [x] DB schema: jobs, job_chains, chain_jobs, user_settings tables
- [x] Navigation: bottom tab bar (mobile-first), 5-tab layout
- [x] App.tsx routes wiring

## Phase 2: Job Cost Calculator
- [x] Quick job entry form (postcode, delivery fee, fuel deposit)
- [x] Google Maps Routes API integration (distance, duration)
- [x] UK Government Fuel Finder API integration (live fuel prices)
- [x] Cost breakdown: fuel, time value, wear & tear, broker fees, risk buffer
- [x] Profit outputs: net profit, profit/hr, profit/mile, traffic light score
- [x] Save job to DB

## Phase 3: Multi-Job Chain Planner
- [x] Chain builder UI (2-3 jobs linked)
- [x] TransportAPI integration (train/bus reposition routes, with mock fallback)
- [x] No-transit zone detection
- [x] Combined chain profitability view
- [x] Risk flags (tight connections, rural areas)

## Phase 4: Route Comparison
- [x] Multiple transport options shown per reposition leg (train, bus, taxi)
- [x] Cost/time comparison per option in chain planner

## Phase 5: Job History & Day Planner
- [x] Job history list with daily/weekly/monthly summaries
- [x] Earnings chart (30-day bar chart)
- [x] Day planner timeline view with job status controls
- [x] Mark jobs as active/completed from planner

## Phase 6: Sharing, Alerts & AI
- [x] Shareable job chain links (read-only public view, 7-day expiry)
- [x] AI recommendations via LLM (routes, timing, pricing, chain opportunities)
- [x] Settings: alerts toggle, home postcode, all cost preferences

## Phase 7: Tests & Delivery
- [x] Vitest unit tests for cost calculator logic (12 tests)
- [x] Vitest tests for auth.logout
- [x] Database migration applied
- [x] TypeScript: 0 errors
- [x] All tests passing

## Feature: AI Booking Screenshot Scanner
- [x] Server: tRPC procedure to accept image URL and extract job fields via LLM vision
- [x] Server: Upload image to S3, pass URL to LLM with structured JSON schema response
- [x] Frontend: Camera/upload button on Calculator page
- [x] Frontend: Show extracted fields preview with edit-before-confirm step
- [x] Frontend: Auto-fill all form fields from extracted data

## Feature: Full Job Logging & Job Sheet
- [x] DB: Add scan fields to jobs table
- [x] Server: Update jobs procedures to accept all scan fields
- [x] Frontend: Job sheet shows full details

## Feature: Enhanced Calculator & Job Card
- [x] Cost breakdown: fuel deposit as +income
- [x] Travel expenses: to-job and home costs
- [x] Receipt scanner: scan fuel/train/parking receipts via AI

## Feature: Multi-Modal Route Finder
- [x] Google Maps Directions API (transit, driving, walking)
- [x] Ranked route cards: Fastest / Cheapest / Balanced
- [x] Interactive map with colour-coded legs
- [x] Departure time picker
- [x] Saved favourite routes

## Feature: Driver Dashboard & Gamification
- [x] Dashboard with hero stats, weekly chart, AI insights
- [x] Badges system (20 badges, progress tracking)
- [x] Streaks counter

## Feature: Landing Page
- [x] Hero with animated background
- [x] Feature explainer, how it works, stats bar
- [x] PWA manifest and icons

## Feature: Stripe Freemium (Free vs Pro)
- [x] Stripe client setup (server/stripe/client.ts)
- [x] Products/prices config (server/stripe/products.ts)
- [x] Stripe webhook handler (/api/stripe/webhook)
- [x] Subscription router (checkout, portal, status)
- [x] ProGate paywall component
- [x] Subscription management page (/subscription)
- [x] Pro upgrade card in Settings page

## Feature: Vehicle Condition Logger
- [x] DB schema: vehicleConditionReports table
- [x] vehicleCondition router (create, list, get, delete)
- [x] Vehicle Condition Logger page (/vehicle-condition)
- [x] Photo/video upload via S3
- [x] Damage notes and condition checklist
- [x] Share report link
- [x] ProGate gating

## Feature: Fuel Station Finder
- [x] Fuel Finder page (/fuel-finder)
- [x] Google Maps Places API integration
- [x] Nearby station search by postcode or GPS
- [x] Station list with distance, rating, open/closed
- [x] Navigate to station button

## Feature: Tax & Mileage Export
- [x] exports router (mileageCSV, monthlyPL)
- [x] Tax Export page (/tax-export)
- [x] HMRC mileage log CSV download (45p/25p rates)
- [x] Monthly P&L CSV download
- [x] ProGate gating

## Feature: Broker Performance Tracker
- [x] DB schema: brokers table
- [x] brokers router (stats, create, update, delete)
- [x] Brokers page (/brokers)
- [x] Earnings per broker, avg/job, avg/mile
- [x] Star rating, website, phone, notes
- [x] Rank ordering by total earned

## Feature: Driver Lift Marketplace
- [x] DB schema: lifts, liftRequests tables
- [x] lifts router (list, post, myLifts, request, respondToRequest, cancel)
- [x] Lifts page (/lifts)
- [x] Post a lift (from/to postcode, departure, seats, price)
- [x] Browse available lifts
- [x] Request to join a lift
- [x] Accept/reject requests
- [x] 12% platform fee calculation
- [x] ProGate gating

## Feature: Smart Notifications
- [x] DB schema: notifications table
- [x] notifications router (list, markRead, markAllRead, unreadCount)
- [x] Notifications page (/notifications)
- [x] Unread badge in BottomNav
- [x] Lift request/accept/reject notifications
- [x] Notification types: lift_request, lift_accepted, lift_rejected, badge_unlocked, fuel_alert, job_reminder

## Navigation Updates
- [x] Updated BottomNav with "More" overflow menu
- [x] All new routes registered in App.tsx
- [x] Notifications bell with unread count badge

## Tests
- [x] HMRC mileage allowance calculation tests
- [x] Lift platform fee calculation tests
- [x] Subscription tier gating tests
- [x] App router — all new routers registered test
- [x] Auth logout test
- [x] calculateJobCost unit tests
- [x] All 30 tests passing

## Fix: Cost Breakdown Redesign
- [x] shared/routepilot-types: fuel cost shown but NOT deducted (informational only)
- [x] shared/routepilot-types: remove time value, wear & tear, risk buffer from totalCosts
- [x] shared/routepilot-types: travel expenses (to-job + home) are the only deductions
- [x] Calculator UI: update breakdown lines to reflect new logic
- [x] Job history/job sheet: update breakdown display
- [x] Update vitest tests for new calculation logic

## Nav Redesign + Calendar + Jobs
- [x] Propose and confirm new 5-tab nav structure with user
- [x] Build Calendar page with day/week/month views and clickable job cards
- [x] Build Jobs page with all statuses, full details, receipts, route, profit
- [x] Integrate calculator into Jobs "Add Job" flow (remove standalone /calculator route from nav)
- [x] Integrate route finder into Jobs detail / Add Job flow (remove standalone /routes from nav)
- [x] Update BottomNav to new 5-tab structure (Home, Calendar, Jobs, Tools, Me)
- [x] Update App.tsx routes

## UX Improvements (Round 2)
- [x] Calendar: "+" button pre-fills scheduled date/time from tapped slot/day
- [x] Jobs: swipe-right to mark Started, swipe-left to Cancel
- [x] Dashboard: "Next Job" card taps into full job detail sheet

## Features Round 3

- [x] Calendar: day earnings strip above week/day grid
- [x] DB: add scheduledDropoffAt, contact fields, travelRouteData to jobs table
- [x] Server: extend OCR scan to extract full job data (vehicle, contacts, addresses, times)
- [x] Server: extend jobs create/update to accept all new fields
- [x] Add Job form: show all new fields, wire up OCR auto-populate
- [x] Job Detail Sheet: display all new fields (dropoff time, contacts, full vehicle details)
- [x] Travel Planner: multi-modal step-by-step journey with bus/train/taxi and costs
- [x] Push notifications: PWA service worker + 30-min job reminder
- [x] Auto-schedule reminder when a job with a scheduled time is saved

## Bug Fix: Create Job Error
- [x] Diagnose runtime error when creating a job — jobs.create did not return insertId, causing crash in notification scheduler
- [x] Fix: return jobId from create procedure; fix frontend to read it correctly

## Bug Fix: Create Job Error (Round 2)
- [x] Fix insertId extraction: use .values({...}).$returningId() (correct Drizzle chain order)
- [x] Add defensive try/catch in scheduleJobReminder (iOS Safari / browsers without Notification API)
- [x] Wrap onSaved reminder call in try/catch so job save never crashes even if notifications fail

## Fix: Duplicate Tools Icon in BottomNav
- [x] Remove duplicate/blank Tools tab from bottom navigation

## Bug Fix: Persistent Create Job Crash
- [x] Fixed: TiDB returns decimal columns as strings; added Number() coercion in jobs.list/get/history queries
- [x] Fixed: Added fmt() safe formatter in Jobs.tsx to prevent .toFixed() crashes on non-numbers
- [x] Fixed: totalEarnings/totalProfit/totalMiles reduce calls now use Number() coercion

## Bug Fix: Chain Planner Crash
- [x] Fix numeric coercion in chains router (TiDB string decimals) — Number() wrap on all job fields before arithmetic
- [x] Fix .toFixed() calls in ChainPlanner frontend with safe fmt() helper

## Feature: Chain Planner Full Door-to-Door Timeline
- [x] Server: chains.plan includes home→pickup1 and lastDropoff→home transport legs
- [x] Server: all 5 leg types returned (homeToPickup, driveLeg, reposition, driveLeg, homeReturn)
- [x] UI: full expandable timeline with drive legs and transport legs interleaved
- [x] UI: each transport leg shows all options (train/bus/taxi), tap to select with instant cost recalculation
- [x] UI: summary includes home travel costs in total deductions
- [x] UI: chain route is openable/collapsible per leg

## Feature: Real Transit Directions in Chain Planner
- [x] Server: tRPC procedure to query Google Maps Directions API (transit mode) for real bus/train/walk options
- [x] Server: return step-by-step journey (walk to stop, bus number, train line, walk to destination) with real times and costs
- [x] Server: time-match departures to job scheduled times (leave early enough to arrive at pickup on time)
- [x] UI: display real multi-step journey steps in each transport leg card
- [x] UI: show walk/bus/train icons per step with duration and cost
- [x] UI: show total journey time and total cost per leg
- [x] UI: step-by-step breakdown visible when transport option is selected (walk → bus → train detail)
- [x] Server: improved UK transit cost estimation (tiered rail pricing, bus cap at £2, Tube/Tram rates)
- [x] UI: scheduled pickup time shown on each Drive Job card in chain timeline

## Feature: Edit Job & Duplicate
- [x] Server: jobs.edit procedure (update all job fields)
- [x] Server: jobs.duplicate procedure (clone a job)
- [x] UI: Edit Job sheet (pre-filled form, broker auto-match)
- [x] UI: Duplicate button in job detail sheet
- [x] UI: Broker auto-match in AddJobSheet and EditJobSheet (auto-fill fee % from known brokers)

## Feature: Voi/Lime E-Scooter Travel Options
- [x] Server: add e-scooter option to chain transport legs (Voi & Lime pricing model)
- [x] Server: estimate scooter cost based on distance (unlock fee + per-minute rate)
- [x] Server: add scooter availability flag (urban areas only, 0.5-8km legs)
- [x] UI: scooter icon and option card in TransportLegCard
- [x] UI: Voi/Lime branding in option selector

## Feature: Receipt Scanning (Travel & Fuel)
- [x] DB: receipts table exists (jobId, category, amount, vendor, date, imageUrl, rawExtracted)
- [x] Server: receipts router (scanReceipt, list, attachToJob, applyToJob, delete)
- [x] Server: OCR via LLM vision to extract amount, vendor, date, fuel litres/price from receipt image
- [x] Server: applyToJob procedure updates job travel/fuel costs from scanned receipt
- [x] UI: receipt scanner button in job detail sheet (camera/file picker)
- [x] UI: receipt gallery in job detail sheet showing all scanned receipts with delete
- [x] UI: receipt scan result preview with apply-as selector (Travel to Job / Travel Home / Fuel)
- [x] UI: job cost breakdown shows actual vs estimated with strikethrough when receipt applied

## Fix: Chain Planner Sequential Timing
- [x] Server: calculate reposition departure time = pickup time + drive duration (sequential, not hardcoded "now")
- [x] Server: propagate all leg times sequentially through the chain
- [x] Server: pass departure_time to Google Maps transit API based on actual computed departure
- [x] Server: fallback options use real departure time (not hardcoded 8:00)
- [x] UI: all leg times reflect real sequential flow (drive ends → reposition starts → next pickup)
- [x] UI: "Leave by" time shown on home start node

## Feature: Editable Chain Legs
- [x] UI: edit cost, transport type, and duration inline on each transport leg card
- [x] UI: add a new custom leg (manual postcode, mode, cost, duration)
- [x] UI: delete any leg from the chain
- [x] UI: summary recalculates instantly when any leg is edited/deleted/added

## Feature: Full-Day Route Map on Saved Chain
- [x] UI: show Google Map with all drive legs plotted in chain result section
- [x] UI: DirectionsService plots all waypoints (home → pickup1 → dropoff1 → pickup2 → dropoff2 → home)
- [x] UI: map auto-fits bounds to show all legs

## Fix: Calendar Duplicate Jobs in Chains
- [x] Server: chains.listWithJobs returns job IDs + scheduledDate for each saved chain
- [x] UI: Calendar fetches chains separately and builds a Set of chained job IDs
- [x] UI: standaloneJobs = all jobs minus chained job IDs (no duplicates)
- [x] UI: calendar shows chain as a single grouped card in all 3 views (day/week/month)
- [x] UI: earnings strip uses standalone job profits + chain totalNetProfit (no double-count)

## Fix: Dashboard Stats Double-Counting Chained Jobs
- [x] Server: getDashboardStats excludes jobs in saved chains from individual job sums
- [x] Server: add chain net profits/earnings/miles to today/week totals separately
- [x] Server: history.summary also deduplicates chained jobs and adds chain totals
- [x] UI: Today's Profit, Week Profit, job count, and miles all show correct deduplicated figures

## Feature: Chain Complete Button + Transport Cost Display + Chart Fix
- [x] Server: chains.complete procedure — marks chain status=completed and all its jobs status=completed
- [x] Server: chains.delete procedure — removes chain without deleting individual jobs
- [x] UI: "✓ Complete" and "✕" buttons in Calendar chain card (all 3 views)
- [x] UI: Chain card shows Gross / Travel cost deduction / Net breakdown
- [x] Server: getDashboardStats dailyBreakdown merges standalone job profit + chain profit per day
- [x] UI: Weekly chart bars now include chain profit for each day

## Fix: Transit Cost Calculation Wrong
- [x] Server: travelPlanner.planRoute rewritten to use real Google Maps transit API (not LLM)
- [x] Server: cost per bus step = £2.50 per leg (not distance-based formula giving £12)
- [x] Server: total cost = sum of individual step costs (walk=free, bus=£2.50, train=tiered by distance)
- [x] Server: fallback uses correct £2.50 single bus fare if Google Maps unavailable

## Feature: Quick Chain Linking from Jobs Screen
- [x] UI: "Plan Day" button in Jobs header (next to Add Job)
- [x] UI: Plan Day sheet shows jobs for selected date with time + earnings, tap to select
- [x] UI: "Plan Chain" button navigates to Chain Planner with selected job IDs pre-filled
- [x] UI: Chain Planner reads ?chainJobs= URL param and pre-selects those jobs on load

## Feature: Fully Multimodal Leg Editor
- [ ] Server: each transport leg returns step-level detail (walk, bus, train, taxi each as own step with from/to, duration, cost, departure, arrival)
- [ ] Server: Google Maps transit steps already contain this data — expose it fully per step
- [ ] UI: each transport leg expands to show individual steps as a vertical timeline
- [ ] UI: each step shows mode icon, from/to location, departure/arrival time, duration, cost
- [ ] UI: "Add step" button between any two steps to insert a new leg segment
- [ ] UI: "Remove step" button on each step to delete it from the leg
- [ ] UI: "Swap mode" on each step (walk/bus/train/taxi/scooter) with cost auto-updating
- [ ] UI: edit cost and duration per step inline
- [ ] UI: all timings cascade automatically when any step is changed
- [ ] UI: leg total cost = sum of step costs (auto-calculated)
- [ ] UI: leg total duration = sum of step durations (auto-calculated)

## Feature: Multimodal Step-Level Editing in Chain Planner
- [x] UI: Each transport leg shows step-by-step breakdown (Walk → Bus → Train) in expandable panel
- [x] UI: Each step is individually editable — tap gear icon to edit mode, duration, and description
- [x] UI: "Insert step" button between each pair of steps to add new Walk/Bus/Train/Taxi/Scooter/Ferry steps
- [x] UI: "Remove step" button on each step (disabled when only 1 step remains)
- [x] UI: Leg total duration auto-recalculates from sum of all step durations when steps change
- [x] UI: Chain summary (totalDurationMins, profitPerHour) cascades update when steps change
- [x] UI: Step mode chips shown in collapsed leg header (Walk → Bus → Train icons)
- [x] UI: "Change option" button replaces old inline edit to switch between transport options
- [x] Tests: 9 new vitest unit tests for step insert/remove/update/recalculate logic (37 total)

## Fix: Step Editor Mobile UX
- [x] Make entire step row tappable to open edit form (remove hover-only gear icon)
- [x] Newly inserted steps open in edit mode immediately
- [x] Edit form always accessible on touch devices (no hover dependency)

## Feature: Per-Step Cost Editing
- [x] Add cost field to TransitStep type
- [x] StepEditor: add cost input field alongside mode/duration
- [x] Leg total cost = sum of step costs when steps have costs defined
- [x] Chain summary recalculates totalTransportCost when step costs change

## Feature: Persist Chain Edits to Database
- [x] DB schema: repositionLegs JSON column already exists — used for storage
- [x] Server: chains.saveEdits procedure — stores full modified transportLegs JSON + summary
- [x] Server: chains.save now returns chainId for downstream use
- [x] UI: "Save Edits" button in chain result — persists current step/leg edits
- [x] UI: Save Edits disabled until chain is first saved

## Feature: Shareable Chain Plan Link
- [x] DB schema: shareToken + shareExpiresAt already exist on job_chains
- [x] Server: chains.createShareLink — generates token, returns public URL (7-day expiry)
- [x] Server: chainsPublicRouter.getShared — public procedure, returns chain by token (no auth)
- [x] UI: "Share Plan" button in chain result — generates link and copies to clipboard
- [x] UI: /chain/:token public read-only page showing full journey timeline with step detail

## Feature: Load Saved Chain Edits on Re-open
- [x] Server: chains.getSavedEdits procedure — find saved chain by job IDs, return transportLegs JSON + chainId
- [x] UI: after plan mutation succeeds, query getSavedEdits for the same job IDs
- [x] UI: if saved edits exist, merge them into the fresh plan result (overwrite transport legs)
- [x] UI: show a toast "Restored your saved edits" when edits are applied
- [x] UI: setSavedChainId from the loaded chain so Save Edits / Share Plan work immediately

## Bug Fix: Plan Day 404
- [x] Found: Plan Day was navigating to /tools?chainJobs=... but /tools is not a registered route
- [x] Fixed: changed navigation target to /chain?chainJobs=... (the correct Chain Planner route)
- [x] Chain Planner correctly reads ?chainJobs= param and pre-selects those jobs

## Bug Fix: Chain Planner Issues
- [x] Fix Save Chain "Failed" error — fixed try/catch structure and insertId cast in chains.save
- [x] Fix Add to Calendar — now includes travelToJobCost and correct net profit/transport cost in notes
- [x] Add tappable job cards in chain result — tap any drive job to open bottom sheet with full details
- [x] Show travel/reposition leg in job detail sheet — travel summary shown in card and full step breakdown in sheet
