// TODO: terms/email/phone/info are universal
// rest are dependent on the type of payment
export type PaymentDetails = {
    terms: string;
    type: string;
    bankName: string;
    sortCode: string;
    number: string;
    emailAddress: string;
    phoneNumber: string;
    info: string;
}
