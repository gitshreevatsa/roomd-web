import { CredentialsSignin } from "next-auth";
import type { LoginErrorCode } from "@/lib/auth/login-errors";

/** Thrown from Credentials `authorize` so Auth.js surfaces `result.code`. */
export class LoginCredentialsError extends CredentialsSignin {
  code: LoginErrorCode;

  constructor(code: LoginErrorCode) {
    super();
    this.code = code;
  }
}
