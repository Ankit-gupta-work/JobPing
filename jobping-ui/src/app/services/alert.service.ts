import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AlertHistoryItem, ApiResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/alerts`;

  getAlerts(): Observable<AlertHistoryItem[]> {
    return this.http
      .get<ApiResponse<AlertHistoryItem[]>>(this.base)
      .pipe(map((res) => res.data));
  }
}
