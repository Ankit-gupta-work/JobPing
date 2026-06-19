import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// Keeps already-authenticated users out of /auth pages.
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('accessToken');

  if (token) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
