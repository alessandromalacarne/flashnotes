import type { User } from '../users/user.js';

// Types AuthenticationContext.user from what SessionAuth.validate() returns.
declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: User;
  }
}
