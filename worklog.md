---
Task ID: 1
Agent: Main
Task: Implement employee self-registration (Join) feature and explain employee access flow

Work Log:
- Analyzed current authentication system: login, register (company), and user management flows
- Created `/api/auth/join` endpoint that allows employees to register using a branch code
- Added "Join" tab to the auth page (login screen) with branch code, name, email, password fields
- Added BranchCodeCopyButton component to admin panel for easy code sharing
- Added employee join code display on each branch card in admin panel
- Added "How employees join" guide banner in the admin branches tab
- Added 11 new translation keys (en/sw) for join feature and admin panel
- Tested the full flow: join API → employee created → login works

Stage Summary:
- Employees can now self-register using branch codes shared by their admin
- Admin panel shows branch codes with copy-to-clipboard on each branch card
- The auth page now has 3 tabs: Sign In, Join, Register
- Join creates Employee role users assigned to the specified branch
- All translations added for both English and Kiswahili

---
Task ID: 2
Agent: Main
Task: Add manager access flow, promote/demote quick actions, and Terms of Service

Work Log:
- Added "Promote to Manager" (crown icon) and "Demote to Employee" quick action buttons in admin user list (both mobile card and desktop table layouts)
- Added handlePromoteUser function that calls PUT /api/users with new role
- Created Terms of Service dialog with 6 sections (Account Responsibility, Your Data, Acceptable Use, Access Control, Service Availability, Changes to Terms)
- Added clickable "View Terms of Service" link on auth page footer
- Added 20+ new translation keys (en/sw) for promote/demote and ToS content
- Tested: lint passes, app runs on port 3000 with 200 responses

Stage Summary:
- Admins can now promote employees to managers with a single click (crown icon)
- Admins can also demote managers back to employees
- Terms of Service dialog is accessible from the login page footer
- All translations added for both English and Kiswahili
- ToS covers: account responsibility, data ownership, acceptable use, access control, service availability, changes to terms
