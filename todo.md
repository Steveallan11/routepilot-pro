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
- [x] All 15 tests passing
- [ ] Final checkpoint and delivery

## Bugs
- [x] Sign in / sign up not working — resolved: Sign In button added to nav bar; works on published URL

## Feature: AI Booking Screenshot Scanner
- [x] Server: tRPC procedure to accept image URL and extract job fields via LLM vision
- [x] Server: Upload image to S3, pass URL to LLM with structured JSON schema response
- [x] Frontend: Camera/upload button on Calculator page
- [x] Frontend: Show extracted fields preview with edit-before-confirm step
- [x] Frontend: Auto-fill all form fields from extracted data

## Fix: Scan Booking input
- [x] Remove capture="environment" so users can choose from gallery/files, not just camera

## Feature: Full Job Logging & Job Sheet
- [x] DB: Add scan fields to jobs table (brokerName, jobReference, scheduledDate, pickupAddress, dropoffAddress, distanceMiles, durationMins, bookingImageUrl, notes)
- [x] DB: Migrate schema
- [x] Server: Update jobs.create procedure to accept and store all scan fields
- [x] Server: Update jobs.list/get to return all fields
- [x] Frontend: Pass all scan data through to save mutation
- [x] Frontend: Job sheet shows full details (broker, ref, addresses, distance, duration, image thumbnail)
- [x] Frontend: History list shows broker name and job reference

## Feature: Enhanced Calculator & Job Card
- [x] Cost breakdown: show fuel deposit as +income line (already reimbursed, adds to total)
- [x] Travel expenses: add fields for travel-to-job cost and travel-home/next-job cost (postcode + mode)
- [x] Travel expenses: deduct from net profit and show in breakdown
- [x] Job chaining on calculator: "Add another job" button to chain 2-3 jobs in one calculation
- [x] Job card: show vehicle details (make/model, reg, fuel type) from scan or manual entry
- [x] DB: add vehicleMake, vehicleModel, vehicleReg, vehicleFuelType fields to jobs table
- [x] DB: add travelToJobCost, travelHomePostcode, travelHomeCost fields to jobs table
- [x] Receipt scanner: scan fuel/train/parking receipts via AI image read
- [x] Receipt scanner: attach receipts to a job, show in job history
- [x] DB: receipts table (already exists — extend with AI scan fields)
- [x] History: show receipts attached to each job

## Fix: Travel Expenses visibility
- [x] Travel Expenses section: always visible, not hidden behind collapse toggle
- [x] Travel costs (to job + home) always shown in cost breakdown when non-zero
- [x] Travel Expenses and Cost Settings use separate toggles (not same showAdvanced state)
- [x] Cost Settings section stays collapsed by default; Travel Expenses stays open

## Feature: Multi-Modal Route Finder
- [x] Server: tRPC procedure to fetch transit routes from Google Maps Directions API (transit mode)
- [x] Server: Also fetch driving and walking options for comparison
- [x] Server: Rank results as fastest, cheapest, balanced — return all legs with mode, duration, cost
- [x] Frontend: New "Routes" tab or section in Travel Expenses with from/to postcode inputs
- [x] Frontend: Ranked route cards — Fastest / Cheapest / Balanced with duration, cost, steps summary
- [x] Frontend: Tap a route card to open interactive map with colour-coded legs (train=blue, bus=orange, walk=green, taxi=yellow)
- [x] Frontend: Map shows each leg as a polyline with mode icon markers at interchange points
- [x] Frontend: "Use This Route" button on map view — auto-fills travel cost and mode in calculator
- [x] Frontend: Add route finder button in Travel Expenses section for quick access

## Feature: Departure Time Picker
- [x] Add date/time picker to Route Finder page
- [x] Pass departure time to Google Maps Directions API transit request
- [x] Show "departing at X" label on route cards

## Feature: Saved Favourite Routes
- [x] DB: favouriteRoutes table (userId, name, fromPostcode, toPostcode, defaultMode)
- [x] Server: favouriteRoutes router (list, save, delete)
- [x] Frontend: "Save as Favourite" button on Route Finder after search
- [x] Frontend: Favourites list on Route Finder — tap to pre-fill postcodes and search
- [x] Frontend: Quick-load favourite in Travel Expenses section

## Feature: Real-Time UK Train Fares
- [x] Research best available UK train fare API — no public API; using ATOC distance-band model
- [x] Server: ATOC Anytime Single distance-band fare estimation per transit leg
- [x] Frontend: Show estimated fare on train legs with ~£ prefix
- [x] Frontend: Show fare breakdown per leg in route card detail view

## Feature: Route Finder Enhancements (Round 2)
- [x] Home postcode auto-fill: pre-fill From field from user's Settings homePostcode
- [x] Route history: DB table to log every route search used
- [x] Route history: show past routes in Routes tab with date, postcodes, cost, mode
- [x] Shareable route links: generate share token, store route snapshot in DB
- [x] Shareable route links: public page /shared-route/:token with map, legs, and cost
- [x] Shareable route links: share button on route result cards

## Feature: Landing / Splash Page
- [x] Hero image generated (dark, cinematic, car delivery / UK motorway at night)
- [x] Landing page at / (unauthenticated users see landing; authenticated redirect to /dashboard)
- [x] Full-screen hero with animated image background and gradient overlay
- [x] Sign In CTA button prominent in hero
- [x] Feature explainer section (6 key features with icons)
- [x] How it works 3-step section
- [x] Stats bar (£0 fees, 2s to calculate, 25+ badges, 100% UK)
- [x] Footer with tagline

## Feature: Driver Dashboard & Gamification

### Dashboard
- [ ] DB: dashboard stats procedure (today earnings, week earnings, jobs count, miles, profit/hr)
- [ ] DB: next planned job query (soonest scheduled job)
- [ ] Server: dashboard router with stats, next-job, and weekly chart data
- [ ] Frontend: Dashboard page with hero stats (today £, week £, jobs today, miles today)
- [ ] Frontend: Weekly earnings bar chart (7-day)
- [ ] Frontend: Live "Next Job" widget with countdown, route, and travel-to-job button
- [ ] Frontend: AI Insights panel (3 bullet recommendations, refreshable)
- [ ] Frontend: Top stats row: best day this week, avg profit/hr, total miles this week
- [ ] Frontend: Add Dashboard as first tab in bottom nav

### Gamification
- [ ] DB: user_badges table (userId, badgeId, awardedAt, progress)
- [ ] DB: user_streaks table (userId, currentStreak, longestStreak, lastJobDate)
- [ ] Server: badge definitions (20 badges across categories)
- [ ] Server: checkAndAwardBadges() called on every job save
- [ ] Server: streak update logic on job save
- [ ] Frontend: Badges page / section showing all badges (locked/unlocked)
- [ ] Frontend: Badge unlock toast notification with animation
- [ ] Frontend: Streak counter widget on dashboard
- [ ] Frontend: Progress bars on in-progress badges

### Badge Ideas
- [ ] 🚗 First Delivery — save your first job
- [ ] 💰 Ton Up — earn £100 in a single day
- [ ] 🏆 Double Ton — earn £200 in a single day
- [ ] 📍 Century Driver — complete 100 jobs total
- [ ] 🛤️ Road Warrior — drive 1,000 miles in a week
- [ ] 🚂 Train Spotter — use public transport 10 times to reposition
- [ ] 🌿 Eco Driver — save 50kg CO₂ by taking the train instead of driving back
- [ ] ⚡ Speed Runner — complete 5 jobs in a single day
- [ ] 💎 Diamond Driver — maintain 7-day working streak
- [ ] 🔥 On Fire — 3 consecutive days earning over £100
- [ ] 🗺️ Explorer — deliver to 10 different UK cities
- [ ] 🎯 Sharp Shooter — 10 jobs rated "Worth It" in a row
- [ ] 🌙 Night Owl — complete a job after 10pm
- [ ] 🌅 Early Bird — start a job before 7am
- [ ] 🤝 Chain Master — complete a 3-job chain in one day
- [ ] 📸 Scanner Pro — scan 20 booking screenshots
- [ ] 💡 Smart Saver — use the cheapest route option 5 times
- [ ] 🏅 Loyal Driver — use the app for 30 days
- [ ] 🚀 Profit King — achieve £0.50+ per mile on 5 jobs
- [ ] 🌟 Legend — earn £1,000 in a single week
