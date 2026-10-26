# Issue Report: Frontend Cannot Reach Render API

**Status:** Unresolved  
**Affected service:** `https://buhostels-api.onrender.com`  
**Affected endpoint:** `/api/health`  
**Observed:** October 18, 2026

## Summary

The deployed frontend cannot connect to its Render API. The browser reports
`DNS_PROBE_FINISHED_NXDOMAIN` for `buhostels-api.onrender.com`, which means the
hostname is not resolving to an IP address. When DNS lookup fails, the browser
cannot reach the server, so API requests do not get as far as the application
or its CORS checks.

## Evidence

- The frontend config in `frontend/js/config.js` sets its production API base to
  `https://buhostels-api.onrender.com`.
- Render logs report the service live at that same primary URL.
- The logs show `npm start` launching `node server.js`, the application logging
  that it is running, and Render detecting the service on port `10000`.
- Opening the health endpoint in the browser reportedly results in
  `DNS_PROBE_FINISHED_NXDOMAIN`.
- An independent health-endpoint check from this environment also failed at
  hostname resolution. This is consistent with the reported DNS error, though
  it does not establish the current DNS state for every network.

## Impact

Visitors using the deployed frontend cannot use features that depend on the
backend API, including loading hostel data and signing in. Local use can still
work because `frontend/js/config.js` uses a relative API URL on localhost.

## Assessment

The provided logs indicate that the Node process starts and Render sees it
listening on its assigned port. They do not prove the public hostname is
resolvable or that the health endpoint is reachable externally.

The current evidence points first to a hostname/DNS or Render service URL
availability issue, rather than an application startup failure. CORS is not
the cause of an `NXDOMAIN` result: CORS is evaluated only after the browser
resolves the hostname and connects to the server.

## Recommended checks

1. In the Render dashboard, open the web service's **Settings** and copy its
   current **Primary URL**. Confirm that it is exactly
   `https://buhostels-api.onrender.com`.
2. Confirm that the service is not suspended, deleted, or using a different
   service slug, and that its latest deployment is live.
3. From a browser or terminal on more than one network, open
   `https://<current-primary-url>/api/health`. A working endpoint should return
   JSON containing `ok: true`.
4. If the exact Render primary URL differs, update `PRODUCTION_API` in
   `frontend/js/config.js` and redeploy the frontend.
5. If DNS resolves and `/api/health` responds but frontend API calls still
   fail, inspect the browser console's exact error and set Render's
   `CORS_ORIGIN` to the frontend's exact origin, including scheme and hostname.

## Resolution criteria

The issue is resolved when the Render primary URL resolves from the user's
network, `/api/health` returns `200` with `{"ok":true,...}`, and the deployed
frontend can successfully load API-backed content.
