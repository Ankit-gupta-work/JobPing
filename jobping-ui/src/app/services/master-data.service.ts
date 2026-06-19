import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, Experience, Location, Skill } from '../models';

@Injectable({ providedIn: 'root' })
export class MasterDataService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/master`;

  getSkills(): Observable<Skill[]> {
    return this.http
      .get<ApiResponse<Skill[]>>(`${this.base}/skills`)
      .pipe(map((res) => res.data));
  }

  getLocations(): Observable<Location[]> {
    return this.http
      .get<ApiResponse<Location[]>>(`${this.base}/locations`)
      .pipe(map((res) => res.data));
  }

  getExperiences(): Observable<Experience[]> {
    return this.http
      .get<ApiResponse<Experience[]>>(`${this.base}/experiences`)
      .pipe(map((res) => res.data));
  }
}
