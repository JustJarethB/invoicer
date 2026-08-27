export class Address {
    name: string;
    streetAddress: string;
    city: string;
    county: string;
    postCode: string;
    constructor(recipientName: string, street: string, city: string, county: string, postCode: string) {
        this.name = recipientName;
        this.streetAddress = street;
        this.city = city;
        this.county = county;
        this.postCode = postCode;
    }
}
