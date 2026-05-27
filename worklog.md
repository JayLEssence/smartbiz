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
