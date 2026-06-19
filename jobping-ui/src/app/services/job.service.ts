import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, JobDetail, JobFilter, JobListItem, PagedResult } from '../models';

@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/jobs`;

  getJobs(filters: JobFilter): Observable<PagedResult<JobListItem>> {
    let params = new HttpParams();
    if (filters.source) params = params.set('source', filters.source);
    if (filters.location) params = params.set('location', filters.location);
    if (filters.isRemote != null) params = params.set('isRemote', filters.isRemote);
    if (filters.page != null) params = params.set('page', filters.page);
    if (filters.pageSize != null) params = params.set('pageSize', filters.pageSize);
    for (const id of filters.skillIds ?? []) {
      params = params.append('skillIds', id);
    }

    return this.http
      .get<ApiResponse<PagedResult<JobListItem>>>(this.base, { params })
      .pipe(map((res) => res.data));
  }

  getJobById(id: number): Observable<JobDetail> {
    return this.http
      .get<ApiResponse<JobDetail>>(`${this.base}/${id}`)
      .pipe(map((res) => res.data));
  }

  getSavedJobs(): Observable<JobListItem[]> {
    return this.http
      .get<ApiResponse<JobListItem[]>>(`${this.base}/saved`)
      .pipe(map((res) => res.data));
  }

  saveJob(id: number): Observable<void> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.base}/${id}/save`, {})
      .pipe(map(() => void 0));
  }
}
