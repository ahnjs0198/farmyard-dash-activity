# Farmyard Dash

Farmyard Dash is a pixel-art runner built as a Discord Activity. It shows a top-ten leaderboard for each Discord server.

- [Game logic](src/game.js) runs in the browser.
- [Activity client](src/app.js) integrates the game with Discord and submits scores.
- [Worker API](src/worker.js) handles authentication and leaderboard requests.
- [D1 schema](schema.sql) defines score storage.

## Build locally

Run `npm install` and `npm run build`. The build bundles the browser client. A full integration check requires a configured Discord Activity and D1 binding. The repository does not define an automated test suite.

## How it was built

I delegated most of the game implementation, build, and functional checks to Claude Code.
