import { z } from "zod";

/** 3–32 chars: letters, digits, `.`, `_`, `-`. Normalized to lowercase. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._-]{3,32}$/,
    "3 a 32 caracteres: letras, números, `.`, `_` ou `-`",
  );

/** UTF-8 byte length (platform-agnostic; `shared` has no DOM/Node globals). */
export const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    bytes +=
      codePoint < 0x80
        ? 1
        : codePoint < 0x800
          ? 2
          : codePoint < 0x10000
            ? 3
            : 4;
  }
  return bytes;
};

/** bcrypt only uses the first 72 bytes, hence the upper bound. */
export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres")
  .refine((value) => utf8ByteLength(value) <= 72, {
    message: "A senha pode ter no máximo 72 bytes",
  });

export const credentialsSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});
export type Credentials = z.infer<typeof credentialsSchema>;

export const publicUserSchema = z.object({
  id: z.string().min(1),
  username: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;
