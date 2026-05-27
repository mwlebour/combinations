# Task: Deploy & CI/CD Setup

- [x] Project Build Configuration
  - [x] Add `"build": "expo export --platform web"` to `package.json`
- [x] CI/CD Pipeline Configuration
  - [x] Create GitHub Actions workflow `.github/workflows/deploy.yml`
- [x] Verification
  - [x] Run `npm run build` locally to verify production build succeeds
  - [x] Run `npx tsc --noEmit` to verify type safety
- [x] Git Stage & Commit
  - [x] Stage and commit workflow and package changes to `develop`
