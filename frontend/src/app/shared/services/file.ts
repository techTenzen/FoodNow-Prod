// src/app/shared/services/file.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.prod';

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/files`;;

  upload(file: File): Observable<{ filePath: string }> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<{ filePath: string }>(`${this.apiUrl}/upload`, formData);
  }
}