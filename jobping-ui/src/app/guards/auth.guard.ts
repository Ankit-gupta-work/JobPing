import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// Blocks protected routes when no access token is stored.
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('accessToken');

  if (token) {
    return true;
  }
  return router.createUrlTree(['/auth/login']);
};
