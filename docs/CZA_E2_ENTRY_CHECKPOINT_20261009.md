# E2 central intake entry repair — 9 October 2026

Base: a3e3a1437adc20d93c3c55f7091a7322feab9773.
Branch: integration/cza-unified-preview-20261009.

## Problem and resulting behavior
The public assessment hub advertised E2 as active, but its click fell through to an alert saying the profile had not been ported. E2 now navigates to the existing educator intake with `?profile=E2`; the intake validates and selects a requested known profile. It retains the linked-student, birth-date and existing central API requirements. No new identity, assessment engine, data store, permission or credentials.

Files: cza-degerlendirme/app.js, its synchronized public copy, components/central-assessment-intake.tsx.

## Executed validation
- 23 related intake/bridge/E2 tests passed; no skipped tests.
- TypeScript no-emit check and production build passed.
- Real Chromium desktop 1440x1000 and mobile 390x844 navigated by clicking the E2 card and confirmed E2 selected on `/educator/assessment?profile=E2`. No page errors or horizontal overflow.
- No authenticated assessment creation or full E2 recording/report/PDF flow was tested. This is entry acceptance, not full product acceptance.
- Evidence: /workspace/cza-closure-20261009/e2-entry-browser.json, screenshots, e2-entry-tests.log, e2-entry-typecheck.log, e2-entry-build.log.

## Wider verified gaps
Main P2 remains SOURCE_REFERENCE_ONLY and redirects to an inventory/source-reference page. This repair does not mark P2 ready. The old staging default deployment still maps to the September version/8902979 annotation; it is not current main. The supplied marketing Sites address returned HTTP403/error1010 from this environment, and no Sites metadata/version tools are callable here. Its content and project association remain unverified.

## Scope and rollback
No main/staging/production deployment, migration, privilege or existing secret changes. Original AppDeploy P2 source retained. Rollback is revert of this narrow entry patch. Existing dirty original checkout untouched.
