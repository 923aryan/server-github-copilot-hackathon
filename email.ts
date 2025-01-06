import { EmailClient } from "@azure/communication-email";

let emailClient: EmailClient | null = null;

// Function to initialize and return the email client
export const connectToAzureCommunicationService = async () => {
    const connectionString = process.env.ACS_CONNECTION_STRING; // Load from environment variables
    if (!connectionString) {
        throw new Error('Azure Communication Services connection string is not set.');
    }
    emailClient = new EmailClient(connectionString);
    console.debug("Connected to Azure Communication Services");

};

// Getter function to get the email client
export const getEmailClient = () => {
    if (!emailClient) {
        throw new Error('Email client is not initialized. Call connectToEmailService first.');
    }
    return emailClient;
};
