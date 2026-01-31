---
description: How to deploy Clean Weather to Staging and Production
---

# Branching & Deployment Strategy

## 1. Local Development
*   **Branch**: `main` (Working copy)
*   **Goal**: Rapid iteration and feature building.
*   **Command**: `npm run dev`
*   **URL**: `http://localhost:5173`

## 2. Staging Environment
*   **Branch**: `main`
*   **Goal**: Beta testing features with real cloud data (Firebase).
*   **When to Deploy**: Whenever you finish a feature in `main` and want to test it on a phone or with beta users.
*   **Command**: `npm run deploy:staging`
*   **URL**: [staging.weatherplot.com](https://staging.weatherplot.com) (or `the-ideal-time.web.app`)

## 3. Production Environment
*   **Branch**: `main` (Deployed to `gh-pages` branch)
*   **Goal**: Stable, public release for all users.
*   **When to Deploy**: Only after features have been verified in Staging.
*   **Command**: `npm run deploy`
    *   *Note: This automatically builds the app and pushes the 'dist' folder to the `gh-pages` branch, which updates the live site.*
*   **URL**: [weatherplot.com](https://weatherplot.com)

---

## Workflow Example

1.  **Work**: You write code on your computer (`main`).
2.  **Test**: You run `npm run dev` to obtain immediate feedback.
3.  **Stage**: You run `npm run deploy:staging` to push `main` to the Staging server.
4.  **Verify**: You open `staging.weatherplot.com` on your phone. Everything looks good.
5.  **Release**: You run `npm run deploy`. This updates the Live site.
