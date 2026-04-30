import Iyzipay from "iyzipay";

if (!process.env.IYZICO_API_KEY || !process.env.IYZICO_SECRET_KEY) {
  console.error("[iyzico] IYZICO_API_KEY veya IYZICO_SECRET_KEY tanımlı değil!");
}

const iyzico = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY!,
  secretKey: process.env.IYZICO_SECRET_KEY!,
  uri: process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com",
});

export default iyzico;

export interface CreatePaymentRequest {
  orderId: string;
  userId: string;
  amount: number;
  email: string;
  fullName: string;
  ipAddress: string;
  description: string;
}

export interface PaymentResponse {
  status: "success" | "failure";
  paymentLink?: string;
  paymentId?: string;
  error?: string;
}
