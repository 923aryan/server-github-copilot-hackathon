import bcrypt from 'bcrypt';
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import jwt from 'jsonwebtoken';
import { getEmailClient } from "../../email";
import User from "../../models/userModel";
import { getDB } from '../../cosmos';
import { ObjectId } from 'mongodb';

const authRoute = new Hono()

authRoute.post('/github/callback', async (c) => {
  try {
    const { code } = c.req.query();
    if (!code) return c.json({ error: 'No code provided' }, 400);

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_ID,
        client_secret: process.env.GITHUB_SECRET,
        code
      })
    });
    const tokenData = await tokenResponse.json();

    if (tokenData.error) return c.json({ error: tokenData.error }, 400);

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${tokenData.access_token}`
      }
    });
    const userData = await userResponse.json();
    console.log("data is ", userData);

    const db = getDB();

    const collection = db.collection('users');

    const query = { 'github.id': userData.id };
    const update = {
      $set: {
        username: userData.login,
        email: userData.email || null,
        github: {
          id: userData.id,
          token: tokenData.access_token,
          email: userData.email,
          name: userData.name,
          avatarUrl: userData.avatar_url || ""
        },
        displayName: userData.name || userData.login,
        verified: userData.email ? true : false
      }
    };
    const options = { upsert: true, new: true };

    const user = await collection.updateOne(query, update, options);


    const userCreated = await collection.findOne(query)!;

    console.log("uer is ", userCreated?._id)

    // Create JWT
    const jwtToken = jwt.sign({
      id: userCreated?._id.toString() || userData.id,
      username: userData.login
    }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    return c.json({ jwt: jwtToken });
  } catch (error) {
    console.error("Error during upsert:", error);
    return c.json({ error: 'An error occurred while saving user data' }, 500);
  }
});

function createUserPayload(user: any) {
  return {
    id: user._id,
    username: user.username,
    email: user.email
  };
}

// Signup with Email Verification
authRoute.post('/signup', async (c) => {
  try {
    const { username, email, password } = await c.req.json();
    const hashedPassword = await bcrypt.hash(password, 10);

    const db = getDB();
    const collection = db.collection('users');

    // Check if username is already taken
    const usernameExists = await collection.findOne({ username });
    if (usernameExists) {
      return c.json({ message: 'Username is already taken' }, 400);
    }

    // Check if email is already verified
    const emailVerified = await collection.findOne({ email, verified: true });
    if (emailVerified) {
      return c.json({ message: 'This email is already verified and in use' }, 400);
    }

    // If no conflicts, attempt to insert or update the user
    const query = { email: email };
    const update = {
      $setOnInsert: {
        username,
        email,
        password: hashedPassword,
        verified: false,
        createdAt: new Date()
      }
    };
    const options = { upsert: true, new: true, returnOriginal: false };

    const result = await collection.updateOne(query, update, options);

    if (result.matchedCount === 0) { // User does not exist, a new document was inserted
      const userId = result.upsertedId?.toString();

      // Create a verification token
      const verificationToken = jwt.sign({ id: userId }, process.env.JWT_SECRET!, { expiresIn: '1d' });
      console.log("resutl is ", result)
      console.log("singing id is ", userId)
      const verificationLink = `${process.env.CLIENT_ORIGIN}/auth/verify-email?token=${verificationToken}`;

      const emailMessage = {
        senderAddress: process.env.VERIFIED_ACS_SENDER_ADDRESS!,
        content: {
          subject: 'Verify Your Email',
          plainText: `Please verify your email by clicking this link: ${verificationLink}`,
          html: `<p>Please verify your email by clicking this link:</p>
                 <a href="${verificationLink}">${verificationLink}</a>`,
        },
        recipients: {
          to: [
            {
              address: email,
              displayName: username
            },
          ],
        },
      };

      await getEmailClient().beginSend(emailMessage);

      return c.json({ message: 'Verification email sent. Please check your email to verify your account.' }, 201);
    } else {
      // This case would only happen if the email exists but wasn't verified, which we allow for a new signup attempt
      return c.json({ error: 'An account with this email already exists but is not verified. Try logging in or use a different email.' }, 400);
    }
  } catch (error) {
    console.error("Error during signup:", error);
    return c.json({ error: 'An error occurred during signup' }, 500);
  }
});

// Verify Email
authRoute.post('/verify-email', async (c) => {
  try {
    const { token } = await c.req.json();
    console.log("check 1")
    if (!token) {
      return c.json({ error: 'Verification token is required.' }, 400);
    }
    console.log("check 2")

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const db = getDB();
    const collection = db.collection('users');
    console.log("check 3")

    // Query to find user by ID from token
    console.log("doceded id is ", decoded.id)

    const userId = new ObjectId(decoded.id);
    console.log("Decoded ID as ObjectId:", userId);
    const user = await collection.findOne({ _id: userId });
    console.log("check 4 ", user)

    if (!user) {
      return c.json({ error: 'Invalid verification token.' }, 400);
    }
    console.log("check 5")

    // Check if the user is already verified
    if (user.verified) {
      return c.json({ message: 'Email already verified.' });
    }
    console.log("check 6")

    // Update user to mark email as verified
    const updateResult = await collection.updateOne(
      { _id: userId },
      { $set: { verified: true } }
    );

    if (updateResult.modifiedCount === 1) {
      // Generate JWT token since email is now verified
      const jwtToken = jwt.sign({
        id: userId,
        username: user.username,
        email: user.email
      }, process.env.JWT_SECRET!, { expiresIn: '1h' });

      return c.json({ message: 'Email verified successfully.', token: jwtToken });
    } else {
      throw new Error('Failed to update user verification status');
    }
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return c.json({ error: 'Invalid or expired token' }, 400);
    }
    console.error('Failed to verify email:', error);
    return c.json({ error: 'An error occurred during email verification' }, 500);
  }
});

// Login
authRoute.post('/login', async (c) => {
  try {
    console.log("check 1 ", await c.req.json())
    const { userIdentifier, password } = await c.req.json();

    if (!userIdentifier || !password) {
      return c.json({ message: 'Username and Password is requird' }, 400);

    }
    const db = getDB();
    const collection = db.collection('users');
    console.log("check 2")

    // Find the user by username or email
    const query = {
      $or: [
        { username: userIdentifier }, // Match by username
        { email: userIdentifier, verified: true } // Match by email only if verified is true
      ]
    };
    console.log("check 3")

    const user = await collection.findOne(query);
    console.log("check 4 ", user)

    if (!user) {
      return c.json({ error: 'User not found or email not verified' }, 401);
    }
    console.log("check 5")

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // If credentials are valid, create and return JWT
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        email: user.email,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return c.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    return c.json({ error: 'An error occurred during login' }, 500);
  }
});


// Logout
authRoute.post('/logout', async (c) => {
  try {
    const token = c.req.header('Authorization')?.split(' ')[1];
    if (token) {
      console.log(`Token to be invalidated: ${token}`);
    }
    return c.json({ message: 'Logged out successfully' });
  } catch (error) {
    return c.json({ error: 'An error occurred during logout' }, 500);
  }
});

// Forgot Password
authRoute.post('/forgot-password', async (c) => {
  try {
    const { userIdentifier } = await c.req.json(); // userIdentifier can be username or email
    if (!userIdentifier) {
      return c.json({ message: 'username or email not provided' }, 400);

    }
    const db = getDB();
    const collection = db.collection('users');

    // Check if the provided identifier is an email or a username
    let user;
    if (userIdentifier.includes('@')) {
      // If it's an email, search by email
      user = await collection.findOne({ email: userIdentifier });
    } else {
      // If it's a username, search by username
      user = await collection.findOne({ username: userIdentifier });
    }

    if (!user) {
      return c.json({ error: 'No account found with that username or email address.' }, 404);
    }

    // Generate password reset token
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, { expiresIn: '15m' });
    const resetLink = `${process.env.CLIENT_ORIGIN}/auth/reset-password?token=${resetToken}`;

    // Send password reset email
    const emailMessage = {
      senderAddress: process.env.VERIFIED_ACS_SENDER_ADDRESS!,
      content: {
        subject: 'Password Reset',
        plainText: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process:\n\n${resetLink}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.`,
        html: `<p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
               <p>Please click on the following link, or paste this into your browser to complete the process:</p>
               <a href="${resetLink}">${resetLink}</a>
               <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`,
      },
      recipients: {
        to: [
          {
            address: user.email, // Send to the user's email
            displayName: user.displayName || user.username
          },
        ],
      },
    };

    // Send the reset password email
    await getEmailClient().beginSend(emailMessage);

    return c.json({ message: 'Password reset email sent. Check Your Email' });
  } catch (error) {
    console.error('Failed to send email:', error);
    return c.json({ error: 'Failed to send reset email. Please try again later.' }, 500);
  }
});

// Reset Password
authRoute.post('/reset-password', async (c) => {
  try {
    const { token, newPassword } = await c.req.json();
    if (!token || !newPassword) {
      return c.json({ message: 'Some error occured' }, 400);
    }
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const db = getDB();
    const collection = db.collection('users');

    // Find the user by ID from the token
    const userId = new ObjectId(decoded.id);
    const user = await collection.findOne({ _id: userId });

    if (!user) {
      return c.json({ error: 'User not found' }, 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    const result = await collection.updateOne(
      { _id: decoded.id },
      { $set: { password: hashedPassword, verified: true } }
    );

    if (result.modifiedCount === 1) {
      return c.json({ message: 'Password has been reset successfully' });
    } else {
      throw new Error('Failed to update password');
    }
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return c.json({ error: 'Invalid or expired token' }, 400);
    }
    console.error('Error resetting password:', error);
    return c.json({ error: 'An error occurred while resetting the password' }, 500);
  }
});

export default authRoute