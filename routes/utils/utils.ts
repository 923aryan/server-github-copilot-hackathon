import { Hono } from "hono";
import { getDB } from "../../cosmos";
import { ObjectId } from 'mongodb';

type CustomContext = { user: Partial<{ id: string }>; };

const utilsRoutes = new Hono<{ Variables: CustomContext }>();

utilsRoutes.get('/search', async (c) => {
    try {
        const db = getDB();
        const collection = db.collection('users');
        const { searchQuery } = c.req.query();
        console.log("query is ", searchQuery);

        if (!searchQuery) {
            return c.json({ message: "Search query is required" }, 400);
        }

        // Convert searchQuery to lowercase for case-insensitive matching
        const lowercaseSearchQuery = searchQuery.toLowerCase();

        // Construct the query to search in username and optionally displayName
        const matchStage = {
            $match: {
                $or: [
                    { username: { $regex: lowercaseSearchQuery, $options: 'i' } },
                    {
                        $and: [
                            { displayName: { $ne: null } }, // Ensure displayName is not null
                            { displayName: { $regex: lowercaseSearchQuery, $options: 'i' } }
                        ]
                    }
                ]
            }
        };

        const aggregationPipeline = [
            matchStage,
            {
                $project: {
                    _id: 1,
                    username: 1,
                    name: {
                        $cond: {
                            if: { $and: [{ $eq: ['$displayName', null] }, { $ne: ['$displayName', ''] }] },
                            then: '$displayName',
                            else: '$username'
                        }
                    },
                    "github.avatarUrl": 1 // Include avatarUrl from GitHub if it exists
                }
            }
        ];


        // Search for users with projection
        const result = await collection.aggregate(aggregationPipeline).toArray();
        console.log("rs is ", result)
        return c.json({ message: "Users found", data: result }, 200);
    } catch (error) {
        console.error('Error during search:', error);
        return c.json({ message: "Search failed" }, 500);
    }
});
// Get user based on search
// Get user based on search
utilsRoutes.get('/searchUser/:userId', async (c) => {
    try {
        const db = getDB();
        const memoriesCollection = db.collection('memories');
        const usersCollection = db.collection('users');
        const userId = c.req.param('userId');

        if (!userId) {
            return c.json({ message: "User ID is required" }, 400);
        }

        // First, fetch user details from users collection
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) }, {
            projection: {
                _id: 1,
                username: 1,
                displayName: 1,
                'github.avatarUrl': 1
            }
        });

        if (!user) {
            return c.json({ message: "User not found" }, 404);
        }

        // Then, fetch memories for this user
        const memories = await memoriesCollection.find({ userId: new ObjectId(userId) }, {
            projection: {
                _id: 1,
                scheduledDate: 1
            }
        }).toArray();

        // Combine user data with their memories
        const result = {
            userInfo: {
                _id: user._id,
                username: user.username,
                displayName: user.displayName,
                github: {
                    avatarUrl: user.github?.avatarUrl
                }
            },
            memories: memories
        };

        return c.json({ message: "User and memories fetched", data: result });
    } catch (error) {
        console.error('Error during user and memory retrieval:', error);
        return c.json({ message: "User or memory retrieval failed" }, 500);
    }
});

export default utilsRoutes;