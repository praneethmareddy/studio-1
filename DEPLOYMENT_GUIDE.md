# CommVerse Deployment Guide for Render

This guide will walk you through deploying both the Next.js frontend and the Express.js backend to Render. We will create two separate "Web Services" within the same Render account.

## Prerequisites

1.  A [Render](https://render.com/) account.
2.  Your code pushed to a GitHub repository.

---

## Step 1: Deploy the Backend (Express Server)

First, we'll deploy the Express server.

1.  From the Render Dashboard, click **New +** and select **Web Service**.
2.  Connect your GitHub account and select your repository.
3.  On the settings page, configure the following:
    *   **Name**: `commverse-backend` (or any name you prefer).
    *   **Root Directory**: `backend` (This is crucial, it tells Render to look inside the `backend` folder).
    *   **Branch**: `main` (or your default branch).
    *   **Runtime**: `Node`.
    *   **Build Command**: `npm install`.
    *   **Start Command**: `npm start`.
    *   **Instance Type**: `Free` (or your preferred plan).

4.  Click **Advanced** to add environment variables.
    *   Click **Add Environment Variable**.
    *   **Key**: `MONGODB_URI`
    *   **Value**: Paste your MongoDB connection string (`mongodb+srv://...`).
    *   Click **Add Environment Variable** again.
    *   **Key**: `PORT`
    *   **Value**: `10000` (Render provides the port, but setting it here is good practice).
    *   Click **Add Environment Variable** again.
    *   **Key**: `CORS_ORIGIN`
    *   **Value**: We will fill this in after deploying the frontend. For now, you can leave it as `*` or a temporary value.

5.  Click **Create Web Service**. Render will start building and deploying your backend.

6.  Once deployed, find the URL for your backend service (it will look like `https://commverse-backend-xxxx.onrender.com`). **Copy this URL.**

---

## Step 2: Deploy the Frontend (Next.js App)

Now, let's deploy the frontend and connect it to the live backend.

1.  From the Render Dashboard, click **New +** and select **Web Service**.
2.  Select the **same GitHub repository** as before.
3.  Configure the settings:
    *   **Name**: `commverse-frontend` (or any name you prefer).
    *   **Root Directory**: Leave this **blank**. Render will detect the Next.js app in the root.
    *   **Branch**: `main` (or your default branch).
    *   **Runtime**: `Node`.
    *   **Build Command**: `npm install && npm run build`.
    *   **Start Command**: `npm start`.
    *   **Instance Type**: `Free`.

4.  Click **Advanced** to add the environment variable for your backend URL.
    *   Click **Add Environment Variable**.
    *   **Key**: `NEXT_PUBLIC_SIGNALING_SERVER_URL`
    *   **Value**: Paste the URL of your deployed backend service that you copied in the previous step (e.g., `https://commverse-backend-xxxx.onrender.com`).

5.  Click **Create Web Service**.

---

## Step 3: Final Configuration (Update CORS)

Once your frontend is deployed, it will have its own URL (e.g., `https://commverse-frontend.onrender.com`). We need to tell the backend to accept requests from this URL.

1.  Go back to your **backend** service's dashboard on Render.
2.  Go to the **Environment** tab.
3.  Find the `CORS_ORIGIN` environment variable and click **Edit**.
4.  Change its value to the URL of your deployed **frontend** service.
5.  Click **Save Changes**. Render will automatically restart your backend server with the new environment variable.

Your application should now be fully deployed and operational!
