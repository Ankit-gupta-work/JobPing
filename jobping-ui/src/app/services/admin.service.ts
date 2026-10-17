import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../models';

export interface FetchJobsResult {
  newJobs: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin`;

  triggerFetchJobs(): Observable<FetchJobsResult> {
    return this.http
      .post<ApiResponse<FetchJobsResult>>(`${this.base}/fetch-jobs`, {})
      .pipe(map((res) => res.data));
  }
}
