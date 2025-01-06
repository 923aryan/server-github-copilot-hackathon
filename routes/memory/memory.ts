import { Hono } from "hono";
import { getDB } from "../../cosmos";
import { ObjectId } from 'mongodb';
import { getAzureBlobClient, readBlob, uploadBlob } from "../../azureBlob";

type CustomContext = { user: Partial<{ id: string }>; };

const memoryRoute = new Hono<{ Variables: CustomContext }>();

// Create Memory with File Upload
memoryRoute.post('/', async (c) => {
    try {
        console.log("check 1")
        const db = getDB();
        const collection = db.collection('memories');

        const formData = await c.req.formData();
        const user = c.get('user');

        const files = formData.getAll('files') as File[];
        const title = formData.get('title') as string;
        const description = formData.get('description') as string | null;
        const tags = formData.get('tags') as string | null;
        const scheduledDate = formData.get('scheduledDate') as string;

        const memoryData = {
            userId: new ObjectId(user.id),
            title,
            description: description || undefined,
            tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((tag: string) => tag.trim())) : undefined,
            scheduledDate,
            files: [] as Array<{ name: string; type: string; size: number; url: string }>
        };

        for (const file of files) {
            const uniqueFileName = `${Date.now()}-${file.name}`;
            // Convert to Buffer for binary files
            const fileContent = await file.arrayBuffer();
            const buffer = Buffer.from(fileContent);

            // Use file.type to set the content type
            const url = await uploadBlob(
                process.env.AZURE_BLOB_CONTAINER_NAME!,
                uniqueFileName,
                buffer,
                file.type
            );
            memoryData.files.push({
                name: file.name,
                type: file.type,
                size: file.size,
                url: url
            });
        }

        const result = await collection.insertOne(memoryData);
        return c.json({ message: "Files uploaded successfully", data: result }, 201);
    } catch (error) {
        return c.json({ message: "Memory creation failed" }, 401);
    }
});

// Read Memories for a User
memoryRoute.get('/all', async (c) => {
    try {
        console.log("sdf")
        const db = getDB();
        const collection = db.collection('memories');

        const userId = c.get("user").id;
        const memories = await collection.find({ userId: new ObjectId(userId) }).toArray();

        return c.json({ message: "Memory fetched", data: memories });
    } catch (error) {
        return c.json({ message: "Memory retrieval failed" }, 500);
    }
});

// Get memory
memoryRoute.get('/:id', async (c) => {
    try {
        const db = getDB();
        const collection = db.collection('memories');

        const memoryId = c.req.param('id');
        const userId = c.get("user").id;

        const memory = await collection.findOne({
            _id: new ObjectId(memoryId),
            userId: new ObjectId(userId)
        });

        if (memory) {
            return c.json({
                ...memory,
                success: true
            });
        } else {
            return c.json({
                message: 'Memory not found',
                success: false
            }, 404);
        }
    } catch (error) {
        console.error("Error in memory retrieval:", error);
        return c.json({
            message: "Memory retrieval failed",
            success: false
        }, 500);
    }
});

memoryRoute.get('/:id/file/:fileIndex', async (c) => {
    try {
        console.log("getting as")
        const db = getDB();
        const collection = db.collection('memories');

        const memoryId = c.req.param('id');
        const fileIndex = parseInt(c.req.param('fileIndex'));
        const userId = c.get("user").id;

        const memory = await collection.findOne({
            _id: new ObjectId(memoryId),
            userId: new ObjectId(userId)
        });

        if (!memory || !memory.files[fileIndex]) {
            return c.json({ message: 'File not found' }, 404);
        }

        const file = memory.files[fileIndex];
        const blobName = decodeURIComponent(file.url.split('/').pop()!);

        // Get the blob stream
        const stream = await readBlob(process.env.AZURE_BLOB_CONTAINER_NAME!, blobName);

        // Convert to ArrayBuffer
        const sink = new Bun.ArrayBufferSink();
        for await (const chunk of stream) {
            sink.write(chunk);
        }
        const buffer = sink.end();

        return new Response(buffer, {
            headers: {
                'Content-Type': file.type,
                'Content-Disposition': `inline; filename="${file.name}"`
            }
        });
    } catch (error) {
        console.error("Error in file retrieval:", error);
        return c.json({ message: "File retrieval failed" }, 500);
    }
});

memoryRoute.put('/:id', async (c) => {
    try {
        const formData = await c.req.formData();

        const db = getDB();
        const collection = db.collection('memories');

        const memoryId = c.req.param('id');

        // Extract form data
        const title = formData.get('title') as string;
        const description = formData.get('description') as string | null;
        const tags = formData.get('tags') as string | null;
        const scheduledDate = formData.get('scheduledDate') as string;
        const files = formData.getAll('files') as File[];

        const update: any = {
            $set: {
                title,
                description: description || undefined,
                tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((tag: string) => tag.trim())) : undefined,
                scheduledDate,
            },
        };

        // Handle new files if any
        if (files && files.length > 0) {
            const newFiles = [];
            for (const file of files) {
                const uniqueFileName = `${Date.now()}-${file.name}`;
                const fileContent = await file.arrayBuffer();
                const buffer = Buffer.from(fileContent);
                const url = await uploadBlob(
                    process.env.AZURE_BLOB_CONTAINER_NAME!,
                    uniqueFileName,
                    buffer,
                    file.type
                );
                newFiles.push({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    url: url,
                });
            }
            update.$push = { files: { $each: newFiles } };
        }

        const userId = c.get("user").id;
        const result = await collection.updateOne(
            { _id: new ObjectId(memoryId), userId: new ObjectId(userId) },
            update
        );

        if (result.modifiedCount === 1) {
            const updatedMemory = await collection.findOne({ _id: new ObjectId(memoryId) });
            return c.json({ message: 'Memory updated', memory: updatedMemory });
        } else {
            return c.json({ message: 'Memory not found or not updated' }, 404);
        }
    } catch (error: any) {
        console.error('Error updating memory:', error);
        return c.json({ message: 'Failed to update memory' }, 500);
    }
});


memoryRoute.delete('/:id', async (c) => {
    try {
        console.log("ff")
        const db = getDB();
        const collection = db.collection('memories');

        const memoryId = c.req.param('id');
        const userId = c.get("user").id;
        const memory = await collection.findOne({ _id: new ObjectId(memoryId), userId: new ObjectId(userId) });

        if (memory) {
            const blobClient = getAzureBlobClient();
            for (const file of memory.files) {
                const blobUrl = new URL(file.url);
                const blobPath = blobUrl.pathname.split('/').pop()!; // Extract blob name from URL
                const containerName = process.env.AZURE_BLOB_CONTAINER_NAME!
                const containerClient = blobClient.getContainerClient(containerName);
                if (blobPath) {
                    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
                    // Attempt to delete the blob
                    await blockBlobClient.deleteIfExists();
                    console.log(`Blob ${blobPath} deleted from container ${containerName}.`);
                }
            }
        }

        const result = await collection.deleteOne({ _id: new ObjectId(memoryId), userId: new ObjectId(userId) });

        if (result.deletedCount === 1) {
            return c.json({ message: 'Memory deleted' });
        } else {
            return c.json({ message: 'Memory not found' }, 404);
        }
    } catch (error) {
        console.error('Error deleting memory:', error);
        return c.json({ message: 'Failed to delete memory' }, 500);
    }
});

export default memoryRoute;