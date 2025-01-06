import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

// Define the interface for the User Document
interface IUser extends Document {
    username: string;
    email: string;
    password?: string;
    google?: {
        id: string;
        token: string;
        email: string;
        name: string;
    };
    github?: {
        id: string;
        token: string;
        email: string;
        name: string;
        avatarUrl?: string
    };
    microsoft?: {
        id: string;
        token: string;
        email: string;
        name: string;
    };
    displayName?: string;
    verified: boolean;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string, cb: (err: any, isMatch: boolean) => void): void;
}

// Define the User Schema
const userSchema = new Schema<IUser>({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        unique: true
    },
    password: {
        type: String,
        // Make password required only if no identity provider is selected
        validate: {
            validator: function (v: string) {
                return !this.google && !this.github && !this.microsoft;
            },
            message: 'Password is required when not using an identity provider.'
        }
    },
    google: {
        id: String,
        token: String,
        email: String,
        name: String
    },
    github: {
        id: String,
        token: String,
        email: String,
        name: String,
        avatarUrl: String
    },
    microsoft: {
        id: String,
        token: String,
        email: String,
        name: String
    },
    displayName: String,
    verified: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save middleware for hashing password
userSchema.pre<IUser>('save', function (next) {
    const user = this;
    if (this.isModified('password') || this.isNew) {
        if (typeof user.password === 'string') {
            bcrypt.genSalt(10, function (err, salt) {
                if (err) return next(err);
                if (user.password) {
                    bcrypt.hash(user.password, salt, function (err, hash) {
                        if (err) return next(err);
                        user.password = hash;
                        next();
                    });
                }
            });
        } else {
            next();
        }
    } else {
        return next();
    }
});


// Method to compare passwords
userSchema.methods.comparePassword = function (candidatePassword: string, cb: (err: any, isMatch: boolean) => void) {
    bcrypt.compare(candidatePassword, this.password, function (err, isMatch) {
        if (err) return cb(err, false);
        cb(null, isMatch);
    });
};

// Create and export the User model
const User = mongoose.model<IUser>('User', userSchema);
export default User;