import {
  Component,
  OnInit,
  inject,
  signal,
  effect,
  ViewChild,
  ElementRef,
  computed
} from '@angular/core';
import {
  CommonModule
} from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import {
  Router,
  RouterLink
} from '@angular/router';
import {
  Cart,
  CartService
} from '../../cart/cart';
import {
  OrderService
} from '../../order/order';
import {
  NotificationService
} from '../../shared/notification';
import qrcode from 'qrcode-generator';

// Enhanced Receipt Interface
interface ReceiptData {
  orderNumber: string;
  orderDate: string;
  orderTime: string;
  customerName: string;
  deliveryAddress: {
    addressLine1: string;
    city: string;
    pinCode: string;
  };
  paymentMethod: string;
  paymentDetails?: string;
  items: any[];
  totalPrice: number;
  taxAmount: number;
  finalAmount: number;
}

// Custom Validator for Expiry Date
export function expiryDateValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const [month, year] = control.value.split('/');
  if (!month || !year || month.length !== 2 || year.length !== 2) {
    return { invalidFormat: true };
  }
  const expiryMonth = Number(month);
  const expiryYear = Number(`20${year}`);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
    return { expired: true };
  }
  return null;
}

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './payment.html',
  styleUrls: ['./payment.css']
})
export class PaymentComponent implements OnInit {
  private cartService = inject(CartService);
  private orderService = inject(OrderService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private fb = inject(FormBuilder);

  cart = signal<Cart | null>(null);
  selectedPaymentMethod = signal('card');
  cardForm!: FormGroup;
  deliveryAddressForm!: FormGroup;
  detectedCardType = signal<'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown'>('unknown');
  isReceiptModalOpen = signal(false);
  receiptData = signal<ReceiptData | null>(null);
  cardFormStatus = signal<'VALID' | 'INVALID'>('INVALID');

  @ViewChild('qrCodeContainer') qrCodeContainer!: ElementRef<HTMLDivElement>;

  isPaymentValid = computed(() => {
    if (!this.deliveryAddressForm.valid) return false;
    const method = this.selectedPaymentMethod();
    if (method === 'card') return this.cardFormStatus() === 'VALID';
    return ['upi', 'wallet', 'cod'].includes(method);
  });

  constructor() {
    effect(() => {
      if (this.selectedPaymentMethod() === 'upi' && this.cart()) {
        this.generateQRCode();
      }
    });
  }

  ngOnInit(): void {
    this.deliveryAddressForm = this.fb.group({
      addressLine1: ['123 Food Street', Validators.required],
      city: ['Hyderabad', Validators.required],
      pinCode: ['500001', [Validators.required, Validators.pattern(/^[1-9]\d{5}$/)]]
    });

    this.cardForm = this.fb.group({
      cardNumber: ['', [Validators.required, this.validateCardNumber]],
      cardHolder: ['John Doe', [Validators.required, Validators.minLength(3)]],
      expiryDate: ['', [Validators.required, expiryDateValidator]],
      cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]]
    });

    this.cardForm.statusChanges.subscribe(status => {
      this.cardFormStatus.set(status as 'VALID' | 'INVALID');
    });

    this.cardForm.get('cardNumber')?.valueChanges.subscribe(value => {
      this.detectCardType(value);
    });

    this.cartService.getCart().subscribe({
      next: (data) => this.cart.set(data),
      error: () => this.notificationService.error('Could not load your cart summary.')
    });
  }

  validateCardNumber(control: AbstractControl) {
    const value = control.value?.replace(/\s/g, '') || '';
    if (value.length !== 16 || !/^\d+$/.test(value)) return { invalidCard: true };
    return null;
  }

  selectPaymentMethod(method: string): void {
    this.selectedPaymentMethod.set(method);
  }

  detectCardType(cardNumber: string): void {
    const digits = cardNumber.replace(/\s/g, '');
    if (/^4/.test(digits)) this.detectedCardType.set('visa');
    else if (/^5[1-5]/.test(digits)) this.detectedCardType.set('mastercard');
    else if (/^3[47]/.test(digits)) this.detectedCardType.set('amex');
    else if (/^6(?:011|5)/.test(digits)) this.detectedCardType.set('discover');
    else this.detectedCardType.set('unknown');
  }

  formatCardNumber(event: any): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 16) value = value.substring(0, 16);
    const formattedValue = value.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    this.cardForm.get('cardNumber')?.setValue(formattedValue);
  }

  formatExpiryDate(event: any): void {
    let input = event.target.value.replace(/\D/g, '');
    if (input.length >= 2) {
      let month = input.substring(0, 2);
      if (parseInt(month) > 12) {
        month = '12';
        input = month + input.substring(2);
      }
      const year = input.substring(2, 4);
      input = month + (year ? '/' + year : '');
    }
    this.cardForm.get('expiryDate')?.setValue(input);
  }

  formatPinCode(event: any): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 6) value = value.substring(0, 6);
    this.deliveryAddressForm.get('pinCode')?.setValue(value);
  }

  generateQRCode(): void {
    setTimeout(() => {
      if (this.qrCodeContainer && this.cart()) {
        const container = this.qrCodeContainer.nativeElement;
        container.innerHTML = '';
        const totalPrice = (this.cart()!.totalPrice * 1.05).toFixed(2);
        const upiString = `upi://pay?pa=foodnow-demo@paytm&pn=FoodNow&am=${totalPrice}&cu=INR`;
        const qr = qrcode(0, 'M');
        qr.addData(upiString);
        qr.make();
        container.innerHTML = qr.createImgTag(5, 10);
        const img = container.querySelector('img');
        if (img) {
          img.style.backgroundColor = 'white';
          img.style.borderRadius = '8px';
        }
      }
    }, 0);
  }

  getPaymentMethodName(): string {
    const method = this.selectedPaymentMethod();
    switch (method) {
      case 'card': return 'Credit/Debit Card';
      case 'upi': return 'UPI Payment';
      case 'wallet': return 'Digital Wallet';
      case 'cod': return 'Cash on Delivery';
      default: return method;
    }
  }

  getPaymentDetails(): string {
    const method = this.selectedPaymentMethod();
    if (method === 'card') {
      const cardNumber = this.cardForm.get('cardNumber')?.value || '';
      const last4 = cardNumber.replace(/\s/g, '').slice(-4);
      return `**** **** **** ${last4}`;
    }
    return '';
  }

  downloadReceipt(): void {
    const receiptElement = document.getElementById('receipt-to-download');
    if (!receiptElement) {
      this.notificationService.error('Receipt not found');
      return;
    }

    // Use modern approach with dynamic import
    import('html2canvas').then(({ default: html2canvas }) => {
      return html2canvas(receiptElement, { 
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true 
      });
    }).then(canvas => {
      // Create PDF content
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `FoodNow-Receipt-${this.receiptData()?.orderNumber || Date.now()}.png`;
      link.href = imgData;
      link.click();
    }).catch(() => {
      // Fallback: simple text receipt
      this.downloadTextReceipt();
    });
  }

  downloadTextReceipt(): void {
    const receipt = this.receiptData();
    if (!receipt) return;

    let receiptText = `
FoodNow - Order Receipt
========================
Order #: ${receipt.orderNumber}
Date: ${receipt.orderDate}
Time: ${receipt.orderTime}
Customer: ${receipt.customerName}

Delivery Address:
${receipt.deliveryAddress.addressLine1}
${receipt.deliveryAddress.city}, ${receipt.deliveryAddress.pinCode}

Payment Method: ${receipt.paymentMethod}
${receipt.paymentDetails ? 'Card: ' + receipt.paymentDetails : ''}

Items Ordered:
`;

    receipt.items.forEach(item => {
      receiptText += `${item.quantity}x ${item.foodItem.name} - ₹${(item.foodItem.price * item.quantity).toFixed(2)}\n`;
    });

    receiptText += `
Subtotal: ₹${receipt.totalPrice.toFixed(2)}
Tax & Fees: ₹${receipt.taxAmount.toFixed(2)}
Total Paid: ₹${receipt.finalAmount.toFixed(2)}

Thank you for ordering with FoodNow!
`;

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const link = document.createElement('a');
    link.download = `FoodNow-Receipt-${receipt.orderNumber}.txt`;
    link.href = URL.createObjectURL(blob);
    link.click();
  }

  closeReceiptModalAndNavigate(): void {
    this.isReceiptModalOpen.set(false);
    this.router.navigate(['/customer/orders']);
  }

  generateOrderNumber(): string {
    return 'FN' + Date.now().toString().slice(-8);
  }

  onPlaceOrder(): void {
    if (!this.isPaymentValid()) {
      this.notificationService.error('Please complete your delivery and payment details correctly.');
      this.deliveryAddressForm.markAllAsTouched();
      if (this.selectedPaymentMethod() === 'card') {
        this.cardForm.markAllAsTouched();
      }
      return;
    }

    this.notificationService.show('Placing your order...', 'loading');
    const currentCart = this.cart();
    const now = new Date();

    // Create comprehensive receipt data
    const receiptData: ReceiptData = {
      orderNumber: this.generateOrderNumber(),
      orderDate: now.toLocaleDateString('en-IN'),
      orderTime: now.toLocaleTimeString('en-IN'),
      customerName: this.selectedPaymentMethod() === 'card' ? 
        this.cardForm.get('cardHolder')?.value || 'Customer' : 'Customer',
      deliveryAddress: this.deliveryAddressForm.value,
      paymentMethod: this.getPaymentMethodName(),
      paymentDetails: this.getPaymentDetails(),
      items: currentCart?.items || [],
      totalPrice: currentCart?.totalPrice || 0,
      taxAmount: (currentCart?.totalPrice || 0) * 0.05,
      finalAmount: (currentCart?.totalPrice || 0) * 1.05
    };

    this.orderService.placeOrder().subscribe({
      next: () => {
        this.notificationService.success('Order placed successfully!');
        this.cartService.getCart().subscribe();
        this.receiptData.set(receiptData);
        this.isReceiptModalOpen.set(true);
      },
      error: () => this.notificationService.error('Could not place your order.')
    });
  }
}