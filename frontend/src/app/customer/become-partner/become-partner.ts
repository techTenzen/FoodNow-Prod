import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { RestaurantService } from '../../restaurant/restaurant';
import { FileService } from '../../shared/services/file';
import { NotificationService } from '../../shared/notification';

interface RestaurantApplication {
  restaurantName: string;
  restaurantAddress: string;
  restaurantPhone: string;
  locationPin: string;
  imageUrl?: string;
}

@Component({
  selector: 'app-become-partner',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './become-partner.html',
    styleUrls: ['./become-partner.css'] // <-- ADD THIS LINE

})
export class BecomePartnerComponent {
  private router = inject(Router);
  private restaurantService = inject(RestaurantService);
  private fileService = inject(FileService);
  private notificationService = inject(NotificationService);

  // A signal to control whether we show the benefits text or the form
  showForm = signal(false);

  applicationForm: RestaurantApplication = this.getEmptyForm();
  selectedImageFile: File | null = null;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedImageFile = input.files[0];
    }
  }

  async onSubmit(): Promise<void> {
    this.notificationService.show('Submitting application...', 'loading');
    let submissionData: RestaurantApplication = { ...this.applicationForm };

    try {
      if (this.selectedImageFile) {
        const uploadResult = await lastValueFrom(this.fileService.upload(this.selectedImageFile));
        if (uploadResult?.filePath) {
          submissionData.imageUrl = uploadResult.filePath;
        }
      }

      await lastValueFrom(this.restaurantService.applyForPartnership(submissionData));
      this.notificationService.success('Application submitted! We will review it shortly.');

      // Navigate back to dashboard after a delay
      setTimeout(() => {
        this.router.navigate(['/customer/dashboard']);
      }, 2000);

    } catch (error) {
      this.notificationService.error('Failed to submit application.');
    }
  }

  private getEmptyForm(): RestaurantApplication {
    return {
      restaurantName: '',
      restaurantAddress: '',
      restaurantPhone: '',
      locationPin: ''
    };
  }
}