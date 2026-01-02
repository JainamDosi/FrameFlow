---
description: How to deploy FrameFlow to Vercel
---

# Deploying FrameFlow to Vercel

FrameFlow is a Vite-based application. Deploying it to Vercel is straightforward.

## Prerequisites
- A Vercel account.
- Your code pushed to a GitHub, GitLab, or Bitbucket repository.

## Deployment Steps

1. **Import Project**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Connect your Git provider and select the `frameflow_-video-frame-extractor` repository.

2. **Configure Build Settings**:
   - Vercel should automatically detect **Vite** as the framework.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Environment Variables**:
   - If you have any keys in your `.env` file (like `GEMINI_API_KEY`), add them in the "Environment Variables" section of the Vercel dashboard.

4. **Deploy**:
   - Click **Deploy**. Vercel will build your application and provide a live URL.

## Technical Notes for Production
- **Client-Side Heavy**: Since processing happens entirely in the user's browser (using Web Workers and OffscreenCanvas), there are no server-side timeouts or payload limits for video processing.
- **Worker Support**: The application uses standard ESM workers which are fully supported by Vercel's build pipeline.
