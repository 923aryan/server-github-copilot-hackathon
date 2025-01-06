import { Hono } from "hono"
import { logger } from 'hono/logger'
import authRoute from "./routes/auth/auth"
import { cors } from "hono/cors"
import { authMiddleware } from "./middleware/authMiddleware"
import type { GitHubUser } from "@hono/oauth-providers/github"
import { getDB } from "./cosmos"
import { ObjectId } from 'mongodb';
import memoryRoute from "./routes/memory/memory"
import utilsRoutes from "./routes/utils/utils"

const app = new Hono()

app.use("*", logger())

app.use(
    cors({
        origin: process.env.CLIENT_ORIGIN!,
        allowHeaders: ['Content-Type', 'X-Custom-Header', 'Upgrade-Insecure-Requests'],
        allowMethods: ['POST', 'GET', 'OPTIONS'],
        exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
        maxAge: 600,
        credentials: true,
    })
)

app.get("/", (c) => c.json({ status: "Server Running" }))

// Define a type for the user context
type CustomContext = { user: Partial<GitHubUser>; };

// Protected routes setup
const protectedRoutes = new Hono<{ Variables: CustomContext }>();
protectedRoutes.use('/*', authMiddleware); // Apply auth middleware to all sub-routes

// User profile route
protectedRoutes.get('/profile', async (c) => {
    const user = c.get('user');

    const db = getDB();
    const collection = db.collection('users');

    const userId = new ObjectId(user.id);

    console.log("getting id as ", userId)

    const userDB = await collection.findOne({
        $or: [
            { _id: userId },
            { 'github.id': user.id },
            { 'microsoft.id': user.id },
            { 'google.id': user.id }
        ]
    });
    console.log("user is ", userDB)

    return c.json(userDB);
});

// Dashboard route
protectedRoutes.get('/dashboard', async (c) => {
    const user = c.get('user');
    return c.json({
        user,
        dashboardData: {
            status: "active"
        }
    });
});


// Setup memory routes under protected routes
protectedRoutes.route('/memory', memoryRoute)

// Routing setup
app.route("/auth", authRoute)
app.route("/api", protectedRoutes)
app.route("/utils", utilsRoutes)


export default app