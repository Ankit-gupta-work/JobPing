// ----- Shared API envelope -----
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string | null;
}

// ----- Master data -----
export interface Skill {
  id: number;
  name: string;
}
export interface Location {
  id: number;
  name: string;
}
export interface Experience {
  id: number;
  name: string;
}

// ----- Auth -----
export interface RegisterRequest {
  fullName: string;
  username: string;
  email: string;
  password: string;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface AuthResponse {
  userId: number;
  fullName: string;
  email: string;
  role: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}
export interface CurrentUser {
  userId: number;
  fullName: string;
  email: string;
  role: string;
}

// ----- Preferences -----
export interface UserPreference {
  experienceId: number | null;
  isRemoteOnly: boolean;
  minSalary: number | null;
  maxSalary: number | null;
  minMatchPercentage: number;
  isEmailNotification: boolean;
  skillIds: number[];
  locationIds: number[];
}
export interface UserPreferenceResponse extends UserPreference {
  skills: Skill[];
  locations: Location[];
  experience: Experience | null;
}

// ----- Jobs -----
export interface JobListItem {
  id: number;
  title: string;
  company: string;
  source: string;
  sourceUrl: string | null;
  location: string | null;
  isRemote: boolean;
  jobType: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  fetchedAt: string;
  skills: string[];
  matchPercentage: number | null;
  isSaved: boolean;
}
export interface JobDetail extends JobListItem {
  description: string | null;
}
export interface JobFilter {
  source?: string | null;
  location?: string | null;
  skillIds?: number[] | null;
  isRemote?: boolean | null;
  page?: number;
  pageSize?: number;
}
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
