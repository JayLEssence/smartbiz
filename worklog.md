---
Task ID: 1
Agent: Main
Task: Implement sidebar redesign, barcode scanner, and offline mode

Work Log:
- Analyzed current sidebar with 12 flat navigation items causing clutter on mobile
- Redesigned sidebar with 5 grouped/collapsible sections (Core, Management, Finance, Insights, System)
- Desktop: Collapsible groups with animated chevrons, auto-expand group containing active view
- Mobile: Shows 3 primary items (POS, Dashboard, Inventory) + "More" button opening a Sheet drawer
- Created barcode-scanner-dialog.tsx with camera-based scanning using @ericblade/quagga2
- Added camera toggle button next to barcode input in POS view
- Scanner supports EAN-13, EAN-8, UPC-A, UPC-E, Code-128, Code-39 formats
- Includes manual input fallback for when camera is unavailable
- Created use-offline.ts hook with offline queue, auto-sync on reconnect
- Created offline-banner.tsx with visual indicators (amber=offline, green=back online, blue=syncing)
- Added OfflineBanner to main page layout
- Added 25+ translation keys for barcode scanner and offline mode (English + Kiswahili)
- All lint checks pass cleanly

Stage Summary:
- Sidebar now organized in collapsible groups, mobile shows only 4 items
- Barcode scanner with camera support added to POS
- Offline mode with sync queue and visual banner added
- All features support English/Kiswahili translations
