import type { User } from '@flashnotes/core';

// Types AuthenticationContext.user from what SessionAuth.validate() returns.
declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: User;
  }
}
