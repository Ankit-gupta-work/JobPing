import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

// Attaches the Bearer token to every request (except auth endpoints),
// and on 401 clears tokens and redirects to login.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  const isAuthEndpoint =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/auth/refresh');

  const token = localStorage.getItem('accessToken');

  const authReq =
    token && !isAuthEndpoint
      ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
      : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    }),
  );
};
