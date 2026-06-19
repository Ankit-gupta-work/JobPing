import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, UserPreference, UserPreferenceResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class PreferenceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/preferences`;

  getPreferences(): Observable<UserPreferenceResponse> {
    return this.http
      .get<ApiResponse<UserPreferenceResponse>>(this.base)
      .pipe(map((res) => res.data));
  }

  updatePreferences(dto: UserPreference): Observable<void> {
    return this.http.put<ApiResponse<unknown>>(this.base, dto).pipe(map(() => void 0));
  }

  addSkill(skillId: number): Observable<void> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/skills`, { skillId })
      .pipe(map(() => void 0));
  }

  removeSkill(skillId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.base}/skills/${skillId}`)
      .pipe(map(() => void 0));
  }

  addLocation(locationId: number): Observable<void> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/locations`, { locationId })
      .pipe(map(() => void 0));
  }

  removeLocation(locationId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(`${this.base}/locations/${locationId}`)
      .pipe(map(() => void 0));
  }
}
