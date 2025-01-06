# server-github-copilot-hackathon

To install dependencies:

```bash
bun install
```

To run:

```bash
bun install
bun run index.ts
```


add .env file 
```sample```

env sample
```COSMOS_MONGODB_USERNAME```
```COSMOS_MONGODB_PASSWORD```
```GITHUB_ID```
```GITHUB_SECRET```
```JWT_SECRET```
```CLIENT_ORIGIN```
```EMAIL_KEY```
```ACS_CONNECTION_STRING```
```VERIFIED_ACS_SENDER_ADDRESS```
```AZURE_BLOB_CONNECTION_STRING```
```AZURE_BLOB_CONTAINER_NAME```

## Azure Services Used:

1. **Azure CosmosDB for MongoDB** - For database
2. **Azure Communication Services** - For Email and Communication
3. **Azure Storage**


### **Azure CosmosDB For Mongodb **

- **Service Used**: Azure Blob Storage
- **Purpose**: Provides a globally distributed, multi-model database service with low latency and high availability, supporting MongoDB APIs
- **Environment Variables**: 
  - `COSMOS_MONGODB_USERNAME`
  - `COSMOS_MONGODB_PASSWORD`

### **Azure Blob Storage**

- **Service Used**: Azure Blob Storage
- **Purpose**: Offers scalable, cost-effective storage for various types of data, used here for storing files, backups, or static content.
- **Environment Variables**: 
  - `AZURE_BLOB_CONNECTION_STRING`
  - `AZURE_BLOB_CONTAINER_NAME`

### **Email Service**

- **Service Used**: Email service (Azure communication services)
- **Purpose**: Used for sending emails, likely for notifications, user confirmations, or alerts.
- **Environment Variables**: 
  - `EMAIL_KEY`
  - `ACS_CONNECTION_STRING`
  - `VERIFIED_ACS_SENDER_ADDRESS`
  
### **GitHub Authentication**

- **Service Used**: GitHub OAuth
- **Purpose**: Integrates GitHub's authentication system to allow users to sign in with their GitHub accounts, enhancing user management and security.
- **Environment Variables**: 
  - `GITHUB_ID`
  - `GITHUB_SECRET`

### **JWT Authentication**

- **Service Used**: JWT (JSON Web Tokens)
- **Purpose**: Manages user authentication and session management securely, ensuring that only authenticated users can access certain parts of the application.
- **Environment Variables**: 
  - `JWT_SECRET`


This setup ensures that your application not only scales efficiently but also maintains high security and provides a seamless user experience through integrated communication and authentication services. Ensure all environment variables are securely managed, especially those containing sensitive information like passwords and secrets.

This project was created using `bun init` in bun v1.1.42. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
