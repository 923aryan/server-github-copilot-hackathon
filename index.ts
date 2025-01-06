import { serve } from "bun";
import { Hono } from "hono";
import app from "./app";
import { connectToMongodb } from "./cosmos";
import { connectToAzureCommunicationService } from "./email";
import { connectToAzureBlobStorageService } from "./azureBlob";

await connectToMongodb()

await connectToAzureCommunicationService()

await connectToAzureBlobStorageService()

const server = serve({
    fetch: app.fetch,
    port: 4050
})

console.log("server started on ", server.port)