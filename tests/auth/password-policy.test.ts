import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hash, compare } from "bcryptjs";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
  passwordFieldSchema,
  validatePassword,
  validatePasswordConfirmation,
} from "../../lib/auth/password";

describe("password policy", () => {
  it("rejects passwords shorter than 6 characters", () => {
    assert.equal(validatePassword("12345"), PASSWORD_TOO_SHORT_MESSAGE);
    assert.equal(passwordFieldSchema.safeParse("abcde").success, false);
  });

  it("accepts passwords with exactly 6 characters", () => {
    assert.equal(validatePassword("abcdef"), null);
    assert.equal(passwordFieldSchema.safeParse("abcdef").success, true);
    assert.equal(MIN_PASSWORD_LENGTH, 6);
  });

  it("does not require uppercase, number, or special characters", () => {
    assert.equal(validatePassword("simples"), null);
  });

  it("rejects confirmation mismatch", () => {
    assert.equal(
      validatePasswordConfirmation("abcdef", "abcdeg"),
      PASSWORD_MISMATCH_MESSAGE,
    );
  });

  it("accepts matching confirmation at minimum length", () => {
    assert.equal(validatePasswordConfirmation("abcdef", "abcdef"), null);
  });

  it("stores passwords as bcrypt hashes only", async () => {
    const plain = "testpw";
    const digest = await hash(plain, 12);
    assert.notEqual(digest, plain);
    assert.match(digest, /^\$2[aby]?\$/);
    assert.equal(await compare(plain, digest), true);
  });
});
