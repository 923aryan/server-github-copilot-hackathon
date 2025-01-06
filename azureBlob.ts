import { BlobServiceClient } from "@azure/storage-blob";

let azureBlobInstance: BlobServiceClient | null = null;

// Function to initialize and return the azure blob client
export const connectToAzureBlobStorageService = async () => {
    const connectionString = process.env.AZURE_BLOB_CONNECTION_STRING!; // Load from environment variables

    if (!connectionString) {
        throw new Error('Azure Blob Service connection string is not set.');
    }
    azureBlobInstance = BlobServiceClient.fromConnectionString(
        connectionString
    );

    console.debug("Connected to Azure Blob Storage service");

};

// Getter function to get the azure blob client
export const getAzureBlobClient = () => {
    if (!azureBlobInstance) {
        throw new Error('Azure Blob client is not initialized. Call azureBlobClient first.');
    }
    return azureBlobInstance;
};

const ensureContainerExists = async (containerName: string): Promise<void> => {
    try {
        const blobClient = getAzureBlobClient();
        const containerClient = blobClient.getContainerClient(containerName);
        const exists = await containerClient.exists();

        if (!exists) {
            await containerClient.create();
            console.log(`Container ${containerName} created successfully.`);
        }
    } catch (error) {
        throw error
    }
};


export const uploadBlob = async (
    containerName: string,
    blobName: string,
    content: Buffer | string,
    contentType?: string
): Promise<string> => {
    try {
        // Ensure the container exists
        await ensureContainerExists(containerName);

        // Get Azure Blob Client
        const blobClient = getAzureBlobClient();
        const containerClient = blobClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        // Determine content type
        const blobContentType = contentType || getContentTypeFromFileName(blobName);

        // If content is string, convert to Buffer to ensure binary data integrity
        const blobContent = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

        // Upload the blob with content type
        await blockBlobClient.uploadData(blobContent, {
            blobHTTPHeaders: {
                blobContentType: blobContentType
            }
        });

        console.log(`Blob ${blobName} uploaded successfully to container ${containerName}.`);

        // Return the Blob URL
        return blockBlobClient.url;
    } catch (error) {
        throw error
    }
};

// Helper function to infer content type from file name
const getContentTypeFromFileName = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'txt':
            return 'text/plain';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'pdf':
            return 'application/pdf';
        case 'docx':
            return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        // Add more cases as needed
        default:
            return 'application/octet-stream'; // Default to binary data if unknown
    }
};

export const readBlob = async (containerName: string, blobName: string) => {
    try {
        const blobClient = getAzureBlobClient();
        const containerClient = blobClient.getContainerClient(containerName);
        const blobClientInstance = containerClient.getBlobClient(blobName);

        // Get blob content including the stream
        const downloadResponse = await blobClientInstance.download();
        // Get the blob stream
        const readableStream = await downloadResponse.readableStreamBody;

        if (!readableStream) {
            throw new Error('No readable stream available');
        }

        return readableStream;
    } catch (error) {
        throw error;
    }
};