import { Db, MongoClient } from 'mongodb';

let db: Db;

export async function connectToMongodb() {

    const COSMOS_MONGODB_USERNAME = process.env.COSMOS_MONGODB_USERNAME!

    const COSMOS_MONGODB_PASSWORD = process.env.COSMOS_MONGODB_PASSWORD!

    const url = `mongodb://${encodeURIComponent(COSMOS_MONGODB_USERNAME)}:${encodeURIComponent(COSMOS_MONGODB_PASSWORD)}@time-capsule.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@time-capsule@`;

    const client = new MongoClient(url);

    await client.connect();

    db = client.db("time_capsule");

    console.debug("Connected to Cosmos MongoDB");
}

export function getDB() {
    if (db) {
        return db;
    } else {
        throw new Error("Database not connected!");
    }
}
