import { z } from "zod";

const sigupScheam = z.object({
    email: z.string().email({message: "Not an email!"}),
    password: z.string().min(6, { message: "Password must be at least 6 characters long" })
})

const siginSchema = z.object({
    email: z.string().email({message: "Not an email!"}),
    password: z.string().min(6, { message: "Password must be at least 6 characters long" })
})