INVO TRACKER ANDROID OFFLINE - EXTENDED PROJECT (SOURCE OVERLAY)

IMPORTANT: This ZIP is NOT a precompiled APK and is NOT verified as fully functional on a phone.

INSTALL:
1. Back up your existing Android Studio InvoTracker project.
2. Copy app/src/main/assets/* into your Android project's app/src/main/assets/ (replace).
3. Copy app/src/main/java/com/invotracker/app/MainActivity.java into your Android project (replace).
4. Keep your existing AndroidManifest.xml with .MainActivity as the launcher.
5. Build > Build APK(s), then install and test on phone.

OFFLINE IMPLEMENTATIONS IN THIS PACKAGE:
- Native SQLite offline registration and login (existing Phase 1 bridge).
- IndexedDB products, inventory updates, contacts, invoices, payments, purchases, quotations, business settings.
- GST amount calculation, CSV export attempt, basic offline review.
- Invoice printing via existing WebView print workflow (PDF download NOT implemented).

KNOWN LIMITATIONS:
- NOT all features are implemented: offline OCR/scan, PDF creation/download, advanced fraud/investigation, voice features, charts from CDN, complex stock analytics and some specialized endpoints.
- Printing/download handling may require native Android integration.
- Existing desktop/cloud data is NOT imported or synced.
- Offline IndexedDB data and SQLite accounts are local to the Android app; clearing app data removes them.
- Not compiled/tested on an Android device here; app may have integration issues.
- External CDN scripts in index.html remain online-only.
- For production use, add encrypted backups, data export/import, robust error handling, and test GST compliance.

Do not claim this is a complete offline release without testing and completing the limitations.
