import type { AuthAPI } from '../../preload/auth-bridge';

declare global {
  interface Window {
    authAPI: AuthAPI;
  }
}
export {};

