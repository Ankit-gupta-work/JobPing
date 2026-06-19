import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, AuthResponse, CurrentUser, LoginRequest, RegisterRequest } from '../models';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'currentUser';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/auth`;

  register(dto: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.base}/register`, dto)
      .pipe(
        map((res) => res.data),
        tap((auth) => this.storeSession(auth)),
      );
  }

  login(dto: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.base}/login`, dto)
      .pipe(
        map((res) => res.data),
        tap((auth) => this.storeSession(auth)),
      );
  }

  logout(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getCurrentUser(): CurrentUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  }

  private storeSession(auth: AuthResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
    const user: CurrentUser = {
      userId: auth.userId,
      fullName: auth.fullName,
      email: auth.email,
      role: auth.role,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}
