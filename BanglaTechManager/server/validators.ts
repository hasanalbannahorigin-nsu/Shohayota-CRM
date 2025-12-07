import { z } from "zod";

// Bangladeshi phone number regex
// Supports formats: +880XXXXXXXXXX, 0XXXXXXXXXX, 88XXXXXXXXXX
const bangladeshiPhoneRegex = /^(\+880|0|88)[0-9]{9,10}$/;

export const bangladeshiPhoneValidator = z
  .string()
  .regex(
    bangladeshiPhoneRegex,
    "Invalid Bangladeshi phone number. Use format: +880XXXXXXXXXX, 0XXXXXXXXXX, or 88XXXXXXXXXX"
  )
  .optional();

// Email validation
export const emailValidator = z
  .string()
  .email("Invalid email address")
  .min(5, "Email must be at least 5 characters")
  .max(150, "Email must not exceed 150 characters");

// Password validation
export const passwordValidator = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

// Bangladeshi address validator
export const bangladeshiAddressValidator = z
  .string()
  .min(5, "Address must be at least 5 characters")
  .max(500, "Address must not exceed 500 characters")
  .optional();

// Company name validator (Bangladeshi context)
export const companyNameValidator = z
  .string()
  .min(2, "Company name must be at least 2 characters")
  .max(150, "Company name must not exceed 150 characters")
  .regex(
    /^[a-zA-Z0-9\s&\-.,()]+$/,
    "Company name contains invalid characters"
  )
  .optional();

// Validation for customer data
export const customerValidationSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters"),
  email: emailValidator,
  phone: bangladeshiPhoneValidator,
  company: companyNameValidator,
  address: bangladeshiAddressValidator,
});

export type CustomerValidation = z.infer<typeof customerValidationSchema>;
