import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: number;
  }
}