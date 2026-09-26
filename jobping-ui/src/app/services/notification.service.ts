import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, Notification } from '../models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/notifications`;

  getNotifications(unreadOnly = false): Observable<Notification[]> {
    const params = unreadOnly ? new HttpParams().set('unread', 'true') : undefined;
    return this.http
      .get<ApiResponse<Notification[]>>(this.base, { params })
      .pipe(map((res) => res.data));
  }

  markRead(id: number): Observable<void> {
    return this.http.patch<ApiResponse<unknown>>(`${this.base}/${id}/read`, {}).pipe(map(() => void 0));
  }

  markAllRead(): Observable<void> {
    return this.http.patch<ApiResponse<unknown>>(`${this.base}/read-all`, {}).pipe(map(() => void 0));
  }
}
