# Central Auth (SSO Hub)

Simple multi-app SSO demo using Logto.

## Apps
- Main Auth Server: main-app on port 3002
- Client App One: client-app/app-one.js on port 3000
- Client App Two: client-app/app-two.js on port 3001

## Setup
1. Install dependencies:
   - cd main-app && npm install
   - cd ../client-app && npm install
2. Create env file:
   - copy main-app/.env.example to main-app/.env
3. Start all apps:
   - from central-auth folder: node run.js

## Environment
Set these in main-app/.env:
- LOGTO_APP_ID
- LOGTO_APP_SECRET
- LOGTO_ENDPOINT
- LOGTO_BASE_URL
- SESSION_SECRET
- MAIN_APP_PORT
- APP_ONE_PORT
- APP_TWO_PORT

## Notes
- .env is ignored by git.
- Use .env.example as a template.
